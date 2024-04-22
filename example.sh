#!/usr/bin/env bash
trap exit SIGQUIT SIGINT
while :; do
  watch -n2 -g ls -l ./sample/example.html && \
    curl -X PUT \
      -H "Content-Type: text/html" \
      -d @sample/example.html \
      --output - \
      http://localhost/example
done
