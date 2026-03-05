from django.urls import path

import home
from home import views

urlpatterns = [
path('',views.home,name='home'),
]