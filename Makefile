SHELL := bash
SSH_KEY ?= ~/.ssh/id_ed25519.pub

all: help

help:
	@echo "test             - run unit tests"
	@echo "run              - serve the site at http://localhost:8000"
	@echo "build            - build the metronom element into output/"

test:
	node --test

run:
	node server.js

build:
	exordos build -i $(SSH_KEY) -f .
