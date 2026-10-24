"""GraphQL schema for the exercise catalog and its translations.

Field names are published in camelCase: Strawberry's auto_camel_case default is
left on, so `up_votes` here is `upVotes` in the schema.

There is no authentication. The catalog is public, so query fields carry no
permission extension. The only writes are the two anonymous translation
mutations, and they identify their caller by nothing but the `clientId` in their
input and a hash of the address: no cookie, no session. That is what keeps the
endpoint's CSRF exemption in `typelearn/urls.py` sound — a forged cross-site
request carries nothing a direct one would not. A mutation that ever reads the
session has to come with the exemption removed.
"""
from collections import defaultdict
from datetime import timedelta
from enum import Enum
from typing import NoReturn, cast

import strawberry
import strawberry_django
from django.conf import settings
from django.core.exceptions import NON_FIELD_ERRORS, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F, Model, Prefetch, QuerySet
from django.utils import timezone
from graphql import GraphQLError
from strawberry.extensions import (
    DisableIntrospection,
    MaxAliasesLimiter,
    MaxTokensLimiter,
    QueryDepthLimiter,
)
from strawberry_django.optimizer import DjangoOptimizerExtension
from strawberry_django.ordering import Ordering

from typelearn.graphql import update_model_instance_based_on_input

from . import models
from .translation.identity import address_hash, valid_client_id


def fail(code: str, message: str) -> NoReturn:
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


# Publishes the model's own choices, by member name (`MACHINE`), so an origin
# added to the model cannot be missing from the schema. `strawberry.enum` marks
# the class itself, which is why fields annotate the model's class directly.
strawberry.enum(models.Translation.Origin, name='TranslationOrigin')


@strawberry.enum
class TranslationRatingValue(Enum):
    UP = 1
    DOWN = -1
    # Withdraws the caller's rating.
    NONE = 0


@strawberry_django.type(model=models.Translation, name='Translation')
class TranslationType:
    """A translation of an exercise's sentence into one language."""

    id: strawberry.auto
    language: strawberry.auto
    text: strawberry.auto
    up_votes: strawberry.auto
    down_votes: strawberry.auto
    origin: models.Translation.Origin


@strawberry_django.input(model=models.Translation)
class TranslationCreateInput:
    """A learner's suggestion. What a client may not choose — its origin, its
    pending status, the hash of its address — the server sets."""

    exercise: strawberry.auto
    language: strawberry.auto
    text: strawberry.auto
    client_id: strawberry.auto


@strawberry_django.input(model=models.TranslationRating)
class TranslationRatingInput:
    translation: strawberry.auto
    client_id: strawberry.auto
    # Not `auto`, which would publish a bare Int: `NONE` withdraws the rating
    # and is no value a stored rating holds.
    value: TranslationRatingValue


@strawberry_django.type(
    model=models.Exercise,
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
    sentence_id: str | None
    up_votes: strawberry.auto
    difficulty: strawberry.auto
    # Published as `File { url }`, which `typelearn.graphql` (imported above)
    # makes the type of every file field.
    original_audio: strawberry.auto

    @strawberry_django.field(prefetch_related=[prefetch_shown_translation])
    def translation(self, language: str) -> TranslationType | None:
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


@strawberry.type
class Query:
    # No resolver, so the library publishes `filters`, `ordering` and
    # `pagination` itself and applies them in that order: the page is cut from
    # the filtered, ordered list. Without `pagination` nothing is cut; a page
    # asked for is capped at `PAGINATION_MAX_LIMIT`.
    exercises: list[ExerciseType] = strawberry_django.field(pagination=True)

    @strawberry_django.field
    def exercise(self, id: strawberry.ID) -> ExerciseType | None:
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
            fail('INVALID_SIZE', f'size must be at least 1, got {size}.')
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


def require_client_id(client_id: str | None):
    if not valid_client_id(client_id):
        fail('INVALID_CLIENT_ID', 'clientId must be a UUID.')


DUPLICATE = ('DUPLICATE', 'That translation has already been submitted.')

# A model validation failure, by the field it names and its code, to the
# refusal a client receives. `not_found` comes from the input applier.
VALIDATION_REFUSALS: dict[tuple[str, str | None], tuple[str, str]] = {
    ('exercise', 'not_found'): ('NOT_FOUND', 'No exercise has that id.'),
    ('translation', 'not_found'): ('NOT_FOUND', 'No translation has that id.'),
    ('text', 'blank'): ('BLANK', 'A translation is required.'),
    ('text', 'max_length'): (
        'TOO_LONG', f'A translation is at most {models.Translation.TEXT_MAX_LENGTH} characters.'
    ),
    (NON_FIELD_ERRORS, 'unique_together'): DUPLICATE,
}


def refuse(error: ValidationError) -> NoReturn:
    """Refuse a model validation failure — the first one — with the API's code
    for it.

    Every field a client does not supply is filled in by the server, so
    anything not in `VALIDATION_REFUSALS` is unforeseen; it is still refused
    with a code rather than as an uncoded error.
    """
    field, errors = next(iter(error.error_dict.items()))
    refusal = VALIDATION_REFUSALS.get((field, errors[0].code))
    if refusal is None:
        fail('INVALID', ' '.join(error.messages))
    fail(*refusal)


def clean_or_fail(instance: Model):
    """Validate a row by the model's own rules before it is saved."""
    try:
        instance.full_clean()
    except ValidationError as error:
        refuse(error)


@strawberry.type
class TranslationMutations:
    @strawberry_django.mutation
    @transaction.atomic
    def rate_translation(self, info: strawberry.Info, data: TranslationRatingInput) -> TranslationType:
        """Record this browser's verdict on a published translation, replacing
        its earlier one; `NONE` withdraws it. The translation's counts move in
        the same transaction as the rating row, so they never disagree."""
        request = info.context.request
        require_client_id(data.client_id)

        rating = models.TranslationRating(address_hash=address_hash(request))
        field_errors: defaultdict[str, list[ValidationError]] = defaultdict(list)
        update_model_instance_based_on_input(data, rating, field_errors)
        if 'translation' not in field_errors:
            # Locked, so two ratings of one translation cannot both read the
            # same old counts.
            rating.translation = models.Translation.objects.select_for_update().get(
                pk=rating.translation_id
            )
        # Only a published translation is visible, so any other is refused as
        # an id no row has. Assigned rather than appended, replacing the
        # applier's own entry, so the response cannot tell a hidden suggestion
        # from nothing.
        if ('translation' in field_errors
                or rating.translation.status != models.Translation.Status.PUBLISHED):
            field_errors['translation'] = [ValidationError('Not found.', code='not_found')]
        if field_errors:
            refuse(ValidationError(field_errors))
        translation = rating.translation

        if over_limit(models.TranslationRating.objects, 'updated_at', request, rating.client_id,
                      settings.TRANSLATION_RATINGS_PER_HOUR):
            fail('RATE_LIMITED', 'Too many ratings. Try again later.')

        existing = models.TranslationRating.objects.filter(
            translation=translation, client_id=rating.client_id
        ).first()
        old = existing.value if existing else 0
        new = rating.value
        if new == old:
            return cast(TranslationType, translation)

        if new == 0:
            existing.delete()
        else:
            if existing:
                # The browser's earlier verdict, changed.
                existing.value, existing.address_hash = new, rating.address_hash
                rating = existing
            clean_or_fail(rating)
            rating.save()

        up_delta = int(new == 1) - int(old == 1)
        down_delta = int(new == -1) - int(old == -1)
        models.Translation.objects.filter(pk=translation.pk).update(
            up_votes=F('up_votes') + up_delta,
            down_votes=F('down_votes') + down_delta,
        )
        translation.refresh_from_db(fields=['up_votes', 'down_votes'])
        return cast(TranslationType, translation)

    @strawberry_django.mutation
    def propose_translation(
        self, info: strawberry.Info, data: TranslationCreateInput
    ) -> TranslationType:
        """Store a learner's suggestion as pending and return it. Nobody else
        sees it until a moderator publishes it in the admin."""
        request = info.context.request
        require_client_id(data.client_id)
        if not translatable_language(data.language):
            fail('UNSUPPORTED_LANGUAGE', f'Translations into {data.language!r} are not accepted.')

        # Built with only what the input cannot carry; the applier sets the rest.
        suggestion = models.Translation(
            origin=models.Translation.Origin.LEARNER,
            status=models.Translation.Status.PENDING,
            address_hash=address_hash(request),
        )
        field_errors: defaultdict[str, list[ValidationError]] = defaultdict(list)
        update_model_instance_based_on_input(data, suggestion, field_errors)
        if field_errors:
            refuse(ValidationError(field_errors))
        suggestion.text = suggestion.text.strip()
        # The model's own rules: not blank, no longer than the column, and not
        # identical to any existing text — the shown translation, a pending
        # suggestion, or one already rejected — which is nothing new to review.
        clean_or_fail(suggestion)

        learner_rows = models.Translation.objects.filter(origin=models.Translation.Origin.LEARNER)
        if over_limit(learner_rows, 'created_at', request, suggestion.client_id,
                      settings.TRANSLATION_PROPOSALS_PER_HOUR):
            fail('RATE_LIMITED', 'Too many suggestions. Try again later.')

        try:
            # A savepoint, so the caught error leaves any surrounding
            # transaction usable.
            with transaction.atomic():
                suggestion.save()
        except IntegrityError:
            # The same text arrived from somewhere else between the check and
            # the insert.
            fail(*DUPLICATE)
        return cast(TranslationType, suggestion)


@strawberry.type
class Mutation:
    @strawberry.field
    def translation(self) -> TranslationMutations:
        """The translation mutations, one level down. The namespace carries no
        permission extension: the API has no authentication."""
        return TranslationMutations()


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
