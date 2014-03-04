REPORTER = dot

test:
	@./node_modules/.bin/zuul -- test/index.js

.PHONY: test
