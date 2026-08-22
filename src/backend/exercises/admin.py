from django.contrib import admin

from .models import Exercise, Progress


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('sentence', 'difficulty', 'up_votes', 'sentence_id')
    list_filter = ('difficulty',)
    search_fields = ('sentence', 'sentence_id')


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ('exercise', 'typed_text', 'is_correct', 'attempts', 'created_at')
    list_filter = ('is_correct',)
