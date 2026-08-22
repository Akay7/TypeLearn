"""
URL configuration for typelearn project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from exercises.schema import schema

urlpatterns = [
    path('admin/', admin.site.urls),
    # csrf_exempt: the schema is read-only and unauthenticated, so the frontend
    # can POST from the Vite origin without first fetching a CSRF cookie. This
    # must be revisited before the first mutation is added.
    path('graphql/', csrf_exempt(GraphQLView.as_view(
        schema=schema,
        graphql_ide='graphiql' if settings.DEBUG else None,
    ))),
]

# In development the runserver serves the ingested audio clips itself, so an
# <audio> element can load MEDIA_URL without a separate web server.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
