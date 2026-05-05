from django.urls import path
from .views import StrokeHistoryView

urlpatterns = [
    path('<str:code>/strokes/', StrokeHistoryView.as_view(), name='stroke_history'),
]
