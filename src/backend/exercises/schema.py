"""GraphQL schema for the exercise catalog.

Field names are published in camelCase: Strawberry's auto_camel_case default is
left on, so `up_votes` here is `upVotes` in the schema.

The schema is read-only. There are no mutations yet, and no authentication:
every exercise is public catalog data, so query fields carry no permission
extension. Both stop being true at the same moment — the first mutation needs
the CSRF exemption in `typelearn/urls.py` revisited and an auth story decided.
"""
from typing import Optional

import strawberry
import strawberry_django
from django.conf import settings
from django.db.models import QuerySet
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

    return strawberry.Schema(query=Query, extensions=extensions)


schema = build_schema()
