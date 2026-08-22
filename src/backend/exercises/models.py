from django.db import models


class Exercise(models.Model):
    """One audio-and-sentence practice item ingested from the corpus."""

    sentence = models.CharField(max_length=255, unique=True)
    sentence_id = models.CharField(max_length=64, blank=True)
    original_audio = models.FileField(upload_to='clips/')
    up_votes = models.IntegerField(default=0)
    difficulty = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.sentence


class Progress(models.Model):
    """One attempt at an exercise. Unused by the MVP, which checks client-side."""

    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='progress')
    typed_text = models.CharField(max_length=255)
    is_correct = models.BooleanField()
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'progress'

    def __str__(self):
        return f'{self.exercise_id}: {"correct" if self.is_correct else "incorrect"}'
