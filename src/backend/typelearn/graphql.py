"""What the project's GraphQL types and resolvers share.

Importing this module also sets how every file field is published, so it is
imported before any type is defined (see `File`).
"""
from collections import defaultdict
from enum import Enum

import strawberry
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db.models import FileField, ImageField, Model
from django.db.models.fields.files import FieldFile
from strawberry import UNSET
from strawberry_django.fields.types import field_type_map


@strawberry.type(name='File')
class File:
    """A stored file, published by where to fetch it and nothing else.

    It replaces Strawberry-Django's `DjangoFileType` for every file field in
    the project, which would also publish the file's path on the server and
    read its size from disk for every row (an image's dimensions too, by
    opening it).
    """

    @strawberry.field
    def url(self, root: strawberry.Parent[FieldFile], info: strawberry.Info) -> str:
        """Absolute, built from the request: it names whatever origin the
        client reached the API through, so no deployment configures a media
        host, and an <audio> element can load it as given."""
        return info.context.request.build_absolute_uri(root.url)


# What a file field declared `auto` is published as, in every app. The map is
# keyed by exact field class, so `ImageField` needs its own entry, and it is
# read when a type is defined, which is why this runs on import.
field_type_map.update({FileField: File, ImageField: File})


def update_model_instance_based_on_input(
    data: object, instance: Model, field_errors: defaultdict[str, list[ValidationError]]
) -> None:
    """Set a Strawberry-Django input's fields onto a row, without saving it.

    A `{ set: id }` relation is resolved to its row. An id no row has, a
    malformed one, or none at all is collected in `field_errors` under the
    field's name as `not_found`, and the relation is left unset: every relation
    an input carries here is required, so naming no row is never a valid
    choice. An enum is stored by its value. A field the input does not carry
    (`UNSET`) is left as it is, and many-to-many relations are skipped, since
    they can only be set once the row is saved.

    `field_errors` holds `ValidationError`s rather than strings, so each keeps
    a code and a resolver refuses them the same way as `full_clean()`'s.
    """
    for field in data.__strawberry_definition__.fields:
        value = getattr(data, field.python_name)
        if value is UNSET:
            continue
        # `django_name` is the column for a foreign key (`exercise_id`);
        # `get_field` accepts it and answers with the relation itself.
        model_field = instance._meta.get_field(field.django_name)
        if model_field.many_to_many:
            continue
        if model_field.is_relation:
            try:
                related = model_field.related_model._default_manager.get(pk=value.set)
            except (ObjectDoesNotExist, ValueError, TypeError, ValidationError):
                field_errors[model_field.name].append(
                    ValidationError('Not found.', code='not_found')
                )
                continue
            setattr(instance, model_field.name, related)
        elif isinstance(value, Enum):
            setattr(instance, model_field.attname, value.value)
        else:
            setattr(instance, model_field.attname, value)
