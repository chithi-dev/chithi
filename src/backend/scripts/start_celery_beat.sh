#!/bin/bash

exec celery -A app.celery beat --loglevel=info