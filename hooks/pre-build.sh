#!/usr/bin/env bash
# يُشغَّل من جذر المستودع قبل Gradle (بعد تطبيق native/ والبلاجنات). المتغيرات: APP_NAME APP_ID VERSION
set -euo pipefail
python3 hooks/launcher_icons.py
