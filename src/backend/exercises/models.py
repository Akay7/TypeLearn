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


class TranslationQuerySet(models.QuerySet):
    def shown_first(self, language):
        """Published translations into `language`, best first: the first row
        per exercise is the one a learner sees. Highest net rating wins, and a
        tie goes to the most recently published — so a newly approved
        suggestion replaces an unrated machine translation."""
        return self.filter(
            language=language, status=Translation.Status.PUBLISHED,
        ).alias(
            net=models.F('up_votes') - models.F('down_votes'),
        ).order_by('-net', models.F('published_at').desc(nulls_last=True), '-id')


class Translation(models.Model):
    """One translation of an exercise's sentence into one language.

    Machine rows are a loaded copy of the committed translation fixture
    (see `exercises/translation/fixture.py`); learner rows are
    suggestions, original data, and wait in `pending` until a moderator
    publishes or rejects them. One table for both, so approving a suggestion
    is a status flip rather than a copy.
    """

    class Origin(models.TextChoices):
        MACHINE = 'machine', 'Machine'
        LEARNER = 'learner', 'Learner'

    class Status(models.TextChoices):
        PUBLISHED = 'published', 'Published'
        PENDING = 'pending', 'Pending'
        REJECTED = 'rejected', 'Rejected'

    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='translations')
    # A base language subtag ('fr'), the same values the interface language takes.
    language = models.CharField(max_length=8)
    text = models.CharField(max_length=500)
    origin = models.CharField(max_length=16, choices=Origin.choices)
    status = models.CharField(max_length=16, choices=Status.choices)
    # Which provider and model produced a machine row; blank for a learner's.
    provider = models.CharField(max_length=64, blank=True)
    # Who suggested a learner row: an opaque browser id and an HMAC of the
    # address, never the address itself. Blank for a machine row. Only the
    # rate limits read them.
    client_id = models.CharField(max_length=64, blank=True)
    address_hash = models.CharField(max_length=64, blank=True)
    # Denormalized from TranslationRating, updated in the same transaction as
    # the rating, so the shown translation is an ORDER BY rather than an
    # aggregate over every rating on every deck fetch.
    up_votes = models.IntegerField(default=0)
    down_votes = models.IntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TranslationQuerySet.as_manager()

    class Meta:
        ordering = ['id']
        constraints = [
            # At most one machine translation per exercise and language: what
            # makes `load_translations` idempotent as a database guarantee.
            models.UniqueConstraint(
                fields=['exercise', 'language'],
                condition=models.Q(origin='machine'),
                name='one_machine_translation_per_language',
            ),
            # No identical text twice, which also refuses re-submitting text a
            # moderator already rejected.
            models.UniqueConstraint(
                fields=['exercise', 'language', 'text'],
                name='unique_translation_text',
            ),
        ]
        indexes = [
            models.Index(fields=['exercise', 'language', 'status'], name='translation_lookup'),
            # The rate limits count a caller's recent suggestions.
            models.Index(fields=['client_id', 'created_at'], name='translation_by_client'),
            models.Index(fields=['address_hash', 'created_at'], name='translation_by_address'),
        ]

    def __str__(self):
        return f'{self.exercise_id} [{self.language}]: {self.text}'


class TranslationRating(models.Model):
    """One browser's verdict on one translation: +1 or -1.

    Withdrawing a rating deletes the row, so there is no zero value.
    """

    translation = models.ForeignKey(Translation, on_delete=models.CASCADE, related_name='ratings')
    client_id = models.CharField(max_length=64)
    address_hash = models.CharField(max_length=64, blank=True)
    value = models.SmallIntegerField(choices=[(1, 'Up'), (-1, 'Down')])
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['translation', 'client_id'], name='one_rating_per_client'
            ),
        ]
        indexes = [
            models.Index(fields=['client_id', 'updated_at'], name='rating_by_client'),
            models.Index(fields=['address_hash', 'updated_at'], name='rating_by_address'),
        ]

    def __str__(self):
        return f'{self.translation_id}: {self.value:+d}'
