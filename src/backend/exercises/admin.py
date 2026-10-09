from django.contrib import admin, messages
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from .models import Exercise, Progress, Translation, TranslationRating


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('sentence', 'difficulty', 'up_votes', 'sentence_id')
    list_filter = ('difficulty',)
    search_fields = ('sentence', 'sentence_id')


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ('exercise', 'typed_text', 'is_correct', 'attempts', 'created_at')
    list_filter = ('is_correct',)


class StatusFilter(admin.SimpleListFilter):
    """Status, defaulting to pending: the changelist is where suggestions are
    moderated, so it opens on the ones waiting. "All" is still one click away."""

    title = 'status'
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return [*Translation.Status.choices, ('all', 'All')]

    def choices(self, changelist):
        for value, label in self.lookup_choices:
            yield {
                'selected': self.value() == value,
                'query_string': changelist.get_query_string({self.parameter_name: value}),
                'display': label,
            }

    def value(self):
        return super().value() or Translation.Status.PENDING

    def queryset(self, request, queryset):
        if self.value() == 'all':
            return queryset
        return queryset.filter(status=self.value())


def recount_votes(translations):
    """Set each translation's counts from its rating rows — the repair for
    counts that ever drift from the ratings they summarize."""
    counted = translations.annotate(
        ups=Count('ratings', filter=Q(ratings__value=1)),
        downs=Count('ratings', filter=Q(ratings__value=-1)),
    )
    for translation in counted:
        if (translation.up_votes, translation.down_votes) != (translation.ups, translation.downs):
            Translation.objects.filter(pk=translation.pk).update(
                up_votes=translation.ups, down_votes=translation.downs
            )


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ('text', 'sentence', 'currently_shown', 'language', 'origin', 'status',
                    'up_votes', 'down_votes', 'created_at')
    list_filter = (StatusFilter, 'origin', 'language')
    search_fields = ('text', 'exercise__sentence')
    list_select_related = ('exercise',)
    readonly_fields = ('up_votes', 'down_votes', 'client_id', 'address_hash', 'provider',
                       'published_at', 'created_at')
    raw_id_fields = ('exercise',)
    actions = ('approve', 'reject', 'recount')

    @admin.display(description='Sentence')
    def sentence(self, translation):
        return translation.exercise.sentence

    @admin.display(description='Shown now')
    def currently_shown(self, translation):
        """What learners see in this language today, to judge the suggestion
        against. One query per row, on a changelist a moderator pages through
        a hundred at a time."""
        shown = Translation.objects.shown_first(translation.language).filter(
            exercise_id=translation.exercise_id
        ).first()
        return shown.text if shown else '—'

    @admin.action(description='Approve: publish the selected translations')
    def approve(self, request, queryset):
        with transaction.atomic():
            updated = queryset.exclude(status=Translation.Status.PUBLISHED).update(
                status=Translation.Status.PUBLISHED, published_at=timezone.now()
            )
        self.message_user(request, f'Published {updated} translation(s).', messages.SUCCESS)

    @admin.action(description='Reject: never show the selected translations')
    def reject(self, request, queryset):
        updated = queryset.update(status=Translation.Status.REJECTED)
        self.message_user(request, f'Rejected {updated} translation(s).', messages.SUCCESS)

    @admin.action(description='Recount votes from the ratings')
    def recount(self, request, queryset):
        recount_votes(queryset)
        self.message_user(request, 'Vote counts recomputed.', messages.SUCCESS)


@admin.register(TranslationRating)
class TranslationRatingAdmin(admin.ModelAdmin):
    list_display = ('translation', 'value', 'updated_at')
    list_filter = ('value',)
    raw_id_fields = ('translation',)
