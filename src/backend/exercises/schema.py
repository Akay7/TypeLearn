"""GraphQL schema for the exercise catalog and its translations.

Field names are published in camelCase: Strawberry's auto_camel_case default is
left on, so `up_votes` here is `upVotes` in the schema.

There is no authentication. The catalog is public, so query fields carry no
permission extension. The only writes are the two anonymous translation
mutations, and they identify their caller by nothing but a `clientId` argument
and a hash of the address: no cookie, no session. That is what keeps the
endpoint's CSRF exemption in `typelearn/urls.py` sound — a forged cross-site
request carries nothing a direct one would not. A mutation that ever reads the
session has to come with the exemption removed.
"""
from datetime import timedelta
from enum import Enum
from typing import Optional

import strawberry
import strawberry_django
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Prefetch, QuerySet
from django.utils import timezone
from graphql import GraphQLError
from strawberry.extensions import (
    DisableIntrospection,
    MaxAliasesLimiter,
    MaxTokensLimiter,
    QueryDepthLimiter,
)
from strawberry_django.fields.field import StrawberryDjangoField
from strawberry_django.optimizer import DjangoOptimizerExtension
from strawberry_django.ordering import Ordering

from . import models
from .translation.identity import address_hash, valid_client_id


def fail(code: str, message: str):
    """Refuse a request with a stable, machine-readable code. The frontend maps
    the code to a message in the learner's language and never parses this
    English one."""
    raise GraphQLError(message, extensions={'code': code})


def translatable_language(language: str) -> bool:
    """A language a translation may be shown or suggested in: an interface
    language other than the one the sentences are already in."""
    return (
        language in settings.SUPPORTED_INTERFACE_LANGUAGES
        and language != settings.TRANSLATION_SOURCE_LANGUAGE
    )


def shown_translations_attr(language: str) -> str:
    """Where a prefetch leaves one language's translations on an exercise. Per
    language, so two aliases asking for two languages do not overwrite each
    other."""
    return f'shown_translations_{language}'


def prefetch_shown_translation(info: strawberry.Info):
    """The optimizer's hint for `Exercise.translation`: one query for the whole
    deck, ordered so the first row per exercise is the one shown.

    The optimizer does not know what a field with an argument needs, so the
    field says so itself. `selected_fields` resolves the argument, variables
    included, for exactly this selection.
    """
    language = info.selected_fields[0].arguments.get('language', '')
    if not translatable_language(language):
        # Nothing to fetch: the resolver answers null without a query.
        return Prefetch('translations', queryset=models.Translation.objects.none(),
                        to_attr=shown_translations_attr('none'))
    return Prefetch(
        'translations',
        queryset=models.Translation.objects.shown_first(language),
        to_attr=shown_translations_attr(language),
    )


@strawberry_django.filter_type(models.Exercise, lookups=True)
class ExerciseFilter:
    """`lookups=True` gives each field the comparison set (`exact`, `gt`, …),
    so `difficulty: {lte: 2}` selects the easy end of the catalog."""

    id: strawberry.auto
    sentence: strawberry.auto
    sentence_id: strawberry.auto
    up_votes: strawberry.auto
    difficulty: strawberry.auto
    created_at: strawberry.auto


@strawberry_django.order_type(models.Exercise)
class ExerciseOrder:
    """What a client may sort by. Sorting is the caller's choice, so no
    resolver here sorts on its own — the model's `Meta.ordering` by id is the
    default and this overrides it per query."""

    id: Ordering
    difficulty: Ordering
    up_votes: Ordering
    created_at: Ordering


@strawberry.enum
class TranslationOrigin(Enum):
    MACHINE = models.Translation.Origin.MACHINE.value
    LEARNER = models.Translation.Origin.LEARNER.value


@strawberry.enum
class TranslationRatingValue(Enum):
    UP = 1
    DOWN = -1
    # Withdraws the caller's rating.
    NONE = 0


@strawberry_django.type(models.Translation, name='Translation')
class TranslationType:
    """A translation of an exercise's sentence into one language."""

    id: strawberry.auto
    language: strawberry.auto
    text: strawberry.auto
    up_votes: strawberry.auto
    down_votes: strawberry.auto

    @strawberry.field
    def origin(self) -> TranslationOrigin:
        return TranslationOrigin(self.origin)


@strawberry.type
class ProposeTranslationResult:
    # Always true when there is no error: a refused suggestion is an error with
    # a code, so a client never has to tell two kinds of "no" apart.
    accepted: bool


@strawberry_django.type(
    models.Exercise,
    name='Exercise',
    filters=ExerciseFilter,
    ordering=ExerciseOrder,
)
class ExerciseType:
    """One audio-and-sentence practice item."""

    id: strawberry.auto
    sentence: strawberry.auto
    # The column is blank-able rather than nullable, but the published contract
    # allows null so a client never has to assume the corpus supplied an id.
    sentence_id: Optional[str]
    up_votes: strawberry.auto
    difficulty: strawberry.auto

    @strawberry.field
    def audio_url(self, info: strawberry.Info) -> str:
        """An absolute URL, because the frontend is served from another origin.

        `FileField.url` is site-relative (`/media/clips/...`), which an <audio>
        element on the Vite origin would resolve against the Vite dev server.
        """
        return info.context.request.build_absolute_uri(self.original_audio.url)

    @strawberry_django.field(prefetch_related=[prefetch_shown_translation])
    def translation(self, language: str) -> Optional[TranslationType]:
        """The translation a learner sees in `language`, or null.

        Null, never an error, for a language nothing is translated into — the
        exercise's own included — so a client can always ask in the interface
        language. Read from the prefetch when the optimizer made one, and
        queried directly otherwise (a resolver reached some other way).
        """
        if not translatable_language(language):
            return None
        prefetched = getattr(self, shown_translations_attr(language), None)
        if prefetched is not None:
            return prefetched[0] if prefetched else None
        return models.Translation.objects.shown_first(language).filter(exercise=self).first()


class LimitedField(StrawberryDjangoField):
    """A list field whose `limit` argument is applied last.

    The published contract takes a plain `limit: Int` rather than the library's
    `pagination` input, so the slice has to be applied by hand. It cannot be
    applied in the resolver: strawberry-django applies `filters` and `ordering`
    to whatever the resolver returns, and Django refuses to filter or reorder a
    queryset once a slice has been taken. Overriding `get_queryset` puts the
    slice after them, where a LIMIT belongs.
    """

    def get_queryset(
        self, queryset: QuerySet, info: strawberry.Info, *, limit: Optional[int] = None, **kwargs
    ) -> QuerySet:
        queryset = super().get_queryset(queryset, info, **kwargs)
        return queryset if limit is None else queryset[:limit]


@strawberry.type
class Query:
    @strawberry_django.field(field_cls=LimitedField)
    def exercises(
        self,
        filters: Optional[ExerciseFilter] = None,
        ordering: Optional[list[ExerciseOrder]] = None,
        limit: Optional[int] = None,
    ) -> list[ExerciseType]:
        """Declaring `filters` and `ordering` in the signature is what publishes
        them: strawberry-django adds those arguments on its own only to fields
        that have no resolver, but it applies whatever arrives under those names
        to the queryset the resolver returns. The resolver therefore hands back
        the unnarrowed queryset and lets the library do the work.
        """
        return models.Exercise.objects.all()

    @strawberry_django.field
    def exercise(self, id: strawberry.ID) -> Optional[ExerciseType]:
        # Returning the queryset rather than the row lets the library resolve it
        # (`.first()`) with the optimizer applied.
        return models.Exercise.objects.filter(pk=id)

    @strawberry_django.field
    def deck(self, size: int) -> list[ExerciseType]:
        """A random sample of the catalog, for a client to practise from
        without downloading all of it.

        `ORDER BY random() LIMIT n` is a top-N heap sort over the table, which
        is milliseconds at the catalog's size. The cap is applied rather than
        refused, so a client asking for too much still gets a deck.
        """
        if size < 1:
            raise GraphQLError(f'size must be at least 1, got {size}.')
        size = min(size, settings.EXERCISE_DECK_MAX_SIZE)
        return models.Exercise.objects.order_by('?')[:size]


def over_limit(queryset: QuerySet, time_field: str, request, client_id: str, limit: int) -> bool:
    """Whether this caller already made `limit` of these rows in the last hour,
    counted by browser id and, separately, by address — a browser that clears
    its id still shares an address. Counted from the rows themselves, so the
    limit is exact across every worker and pod."""
    since = {f'{time_field}__gte': timezone.now() - timedelta(hours=1)}
    recent = queryset.filter(**since)
    return (
        recent.filter(client_id=client_id).count() >= limit
        or recent.filter(address_hash=address_hash(request)).count() >= limit
    )


def require_client_id(client_id: str):
    if not valid_client_id(client_id):
        fail('INVALID_CLIENT_ID', 'clientId must be a UUID.')


def object_or_fail(queryset: QuerySet, pk: strawberry.ID, what: str):
    try:
        found = queryset.filter(pk=int(pk)).first()
    except (TypeError, ValueError):
        found = None
    if found is None:
        fail('NOT_FOUND', f'No {what} has id {pk}.')
    return found


@strawberry.type
class Mutation:
    @strawberry.mutation
    def rate_translation(
        self,
        info: strawberry.Info,
        translation_id: strawberry.ID,
        client_id: str,
        value: TranslationRatingValue,
    ) -> TranslationType:
        """Record this browser's verdict on a published translation, replacing
        its earlier one; `NONE` withdraws it. The translation's counts move in
        the same transaction as the rating row, so they never disagree."""
        request = info.context.request
        require_client_id(client_id)

        with transaction.atomic():
            # Locked, so two ratings of one translation cannot both read the
            # same old counts.
            translation = object_or_fail(
                models.Translation.objects.select_for_update(), translation_id, 'translation'
            )
            if translation.status != models.Translation.Status.PUBLISHED:
                fail('NOT_PUBLISHED', 'Only a published translation can be rated.')
            if over_limit(models.TranslationRating.objects, 'updated_at', request, client_id,
                          settings.TRANSLATION_RATINGS_PER_HOUR):
                fail('RATE_LIMITED', 'Too many ratings. Try again later.')

            existing = models.TranslationRating.objects.filter(
                translation=translation, client_id=client_id
            ).first()
            old = existing.value if existing else 0
            new = value.value
            if new == old:
                return translation

            if new == 0:
                existing.delete()
            elif existing:
                existing.value = new
                existing.address_hash = address_hash(request)
                existing.save()
            else:
                models.TranslationRating.objects.create(
                    translation=translation, client_id=client_id,
                    address_hash=address_hash(request), value=new,
                )

            up_delta = int(new == 1) - int(old == 1)
            down_delta = int(new == -1) - int(old == -1)
            models.Translation.objects.filter(pk=translation.pk).update(
                up_votes=F('up_votes') + up_delta,
                down_votes=F('down_votes') + down_delta,
            )
            translation.refresh_from_db()
        return translation

    @strawberry.mutation
    def propose_translation(
        self,
        info: strawberry.Info,
        exercise_id: strawberry.ID,
        language: str,
        text: str,
        client_id: str,
    ) -> ProposeTranslationResult:
        """Store a learner's suggestion as pending. Nobody sees it until a
        moderator publishes it in the admin."""
        request = info.context.request
        require_client_id(client_id)
        if not translatable_language(language):
            fail('UNSUPPORTED_LANGUAGE', f'Translations into {language!r} are not accepted.')
        exercise = object_or_fail(models.Exercise.objects, exercise_id, 'exercise')

        text = text.strip()
        if not text:
            fail('BLANK', 'A translation is required.')
        if len(text) > settings.TRANSLATION_MAX_LENGTH:
            fail('TOO_LONG', f'A translation is at most {settings.TRANSLATION_MAX_LENGTH} characters.')

        learner_rows = models.Translation.objects.filter(origin=models.Translation.Origin.LEARNER)
        if over_limit(learner_rows, 'created_at', request, client_id,
                      settings.TRANSLATION_PROPOSALS_PER_HOUR):
            fail('RATE_LIMITED', 'Too many suggestions. Try again later.')

        # Identical to any existing text — the shown translation, a pending
        # suggestion, or one already rejected — is nothing new to review.
        duplicate = models.Translation.objects.filter(
            exercise=exercise, language=language, text=text
        )
        if duplicate.exists():
            fail('DUPLICATE', 'That translation has already been submitted.')
        try:
            with transaction.atomic():
                models.Translation.objects.create(
                    exercise=exercise, language=language, text=text,
                    origin=models.Translation.Origin.LEARNER,
                    status=models.Translation.Status.PENDING,
                    client_id=client_id, address_hash=address_hash(request),
                )
        except IntegrityError:
            # The same text arrived from somewhere else between the check and
            # the insert.
            fail('DUPLICATE', 'That translation has already been submitted.')
        return ProposeTranslationResult(accepted=True)


def build_schema() -> strawberry.Schema:
    """Build the schema from the current settings.

    `DEBUG` is read here, when the module is imported — the same moment
    `urls.py` reads it to decide whether to serve GraphiQL. It is a function so
    a test can build a production-shaped schema without re-importing anything.
    """
    extensions = [
        # Generates select_related/prefetch_related from the selection set,
        # which is why no resolver here hand-tunes a queryset.
        DjangoOptimizerExtension,
        # Abuse guards. Each is a class or a factory, never a built instance:
        # every request gets a fresh one, so the limits are read per request.
        lambda: MaxTokensLimiter(max_token_count=settings.STRAWBERRY_MAX_TOKENS),
        lambda: MaxAliasesLimiter(max_alias_count=settings.STRAWBERRY_MAX_ALIASES),
        lambda: QueryDepthLimiter(max_depth=settings.STRAWBERRY_MAX_QUERY_DEPTH),
        # Introspection is a reconnaissance aid against a deployed API, and
        # nothing shipped needs it — clients query the fields they were written
        # against. Development keeps it, as the specs require and as GraphiQL
        # needs.
        *([] if settings.DEBUG else [DisableIntrospection]),
    ]

    return strawberry.Schema(query=Query, mutation=Mutation, extensions=extensions)


schema = build_schema()
