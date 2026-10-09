"""
URL configuration for typelearn project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from exercises.schema import schema

urlpatterns = [
    path('admin/', admin.site.urls),
    # What the container probes answer on. Not `/graphql/`: a GET there serves
    # GraphiQL, which only exists when DEBUG is on, so the obvious probe path
    # passes in development and fails in exactly the environment where a failing
    # probe means the pod never becomes ready. Deliberately touches nothing —
    # no database, no template — so it reports that the process is serving and
    # never turns a slow query into a restart loop.
    path('healthz/', lambda request: HttpResponse('ok', content_type='text/plain')),
    # csrf_exempt: CSRF forges a request that rides on the victim's cookies,
    # and nothing here reads one. The only writes are the anonymous
    # translation mutations, which identify their caller by a `clientId`
    # argument and a hash of the address, so a forged cross-site request can
    # do nothing its author could not do by calling the API directly — and
    # Strawberry refuses mutations over GET regardless. This holds only while
    # no mutation reads the session or the logged-in user: the first one that
    # does must come with this exemption removed and a CSRF token sent.
    path('graphql/', csrf_exempt(GraphQLView.as_view(
        schema=schema,
        graphql_ide='graphiql' if settings.DEBUG else None,
    ))),
]

# There is deliberately no route for MEDIA_URL here, in any mode. The clips are
# served by the media server the chart deploys, which reads the same volume the
# backend writes to — so the path that serves the audio is the same one in
# development and in a deployment. Serving them here under DEBUG is what this
# replaced: it made the arrangement that ships the one nobody ran, and every
# clip 404'd the moment DEBUG was off.
