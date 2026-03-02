# =========================
# Basic Makefile
# =========================

PKG_NAME ?= gnome-shell-extension-openmeteo
UUID     ?= openmeteo-extension@wwktz.github.io

BASE_MODULES = metadata.json COPYING AUTHORS
EXTRA_DIRECTORIES = media

SCHEMA_XML := schemas/org.gnome.shell.extensions.openmeteo.gschema.xml

# ---- Source files (files only; avoid src/preferences directory) ----
SRC_MODULES := $(shell find src -maxdepth 1 -type f -printf '%f ')
SRC_FILES   := $(addprefix src/, $(SRC_MODULES))

PREFS_MODULES := $(shell find src/preferences -type f -printf '%f ')
PREFS_FILES   := $(addprefix src/preferences/, $(PREFS_MODULES))

TOLOCALIZE := $(SRC_FILES) $(PREFS_FILES) $(SCHEMA_XML)

MSGSRC := $(wildcard po/*.po)
MSGMO  := $(MSGSRC:.po=.mo)

# ---- Install paths ----
ifeq ($(strip $(DESTDIR)),)
	INSTALLTYPE = local
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLTYPE  = system
	SHARE_PREFIX = $(DESTDIR)/usr/share
	INSTALLBASE  = $(SHARE_PREFIX)/gnome-shell/extensions
endif

# ---- Version handling ----
GIT_VER := $(shell git describe --long --tags 2>/dev/null | \
	sed 's/^v//;s/\([^-]*-g\)/r\1/;s/-/./g')

ifdef VERSION
	FOUNDVERSION := $(VERSION)
else
	FOUNDVERSION := $(shell \
		sed -n 's/.*"version"[[:space:]]*:[[:space:]]*\([0-9]\+\).*/\1/p' metadata.json \
	)
endif

ZIPVER = -v$(FOUNDVERSION)
TARGZ  = releases/$(PKG_NAME)$(ZIPVER).tar.gz

.PHONY: all clean potfile mergepo install releases help check _build
.SILENT: help

all: _build

check:
	command -v glib-compile-schemas >/dev/null
	command -v msgfmt >/dev/null
	command -v xgettext >/dev/null

clean:
	rm -f schemas/gschemas.compiled
	rm -f po/*.mo
	rm -rf releases _build

schemas/gschemas.compiled: $(SCHEMA_XML)
	glib-compile-schemas --strict schemas/

potfile: po/openmeteo.pot

mergepo: potfile
	for l in $(MSGSRC); do \
		msgmerge -U $$l po/openmeteo.pot; \
	done

po/openmeteo.pot: $(TOLOCALIZE)
	mkdir -p po
	xgettext -k_ -kN_ --from-code utf-8 \
		--keyword=XGT \
		--package-name $(PKG_NAME) \
		-o po/openmeteo.pot \
		$(TOLOCALIZE)

po/%.mo: po/%.po
	msgfmt -c $< -o $@

# ---- Build ----
_build: check schemas/gschemas.compiled $(MSGMO) \
	$(BASE_MODULES) $(SRC_FILES) $(PREFS_FILES) $(EXTRA_DIRECTORIES)
	rm -rf _build
	mkdir -p _build/preferences

	cp $(BASE_MODULES) $(SRC_FILES) _build
	cp $(PREFS_FILES) _build/preferences
	cp -r $(EXTRA_DIRECTORIES) _build

	mkdir -p _build/schemas
	cp $(SCHEMA_XML) schemas/gschemas.compiled _build/schemas

	mkdir -p _build/locale
	for l in $(MSGMO); do \
		lang=$$(basename $$l .mo); \
		mkdir -p _build/locale/$$lang/LC_MESSAGES; \
		cp $$l _build/locale/$$lang/LC_MESSAGES/$(PKG_NAME).mo; \
	done

ifdef VERSION
	sed -i 's/"version": .*/"version": $(VERSION)/' _build/metadata.json
else ifneq ($(strip $(GIT_VER)),)
	sed -i '/"version": .*/i\ \ "git-version": "$(GIT_VER)",' _build/metadata.json
endif

# ---- Install ----
install: _build
	rm -rf $(INSTALLBASE)/$(UUID)
	mkdir -p $(INSTALLBASE)/$(UUID)
	cp -r _build/* $(INSTALLBASE)/$(UUID)

ifeq ($(INSTALLTYPE),system)
	rm -rf \
		$(INSTALLBASE)/$(UUID)/schemas \
		$(INSTALLBASE)/$(UUID)/locale \
		$(INSTALLBASE)/$(UUID)/COPYING

	mkdir -p \
		$(SHARE_PREFIX)/glib-2.0/schemas \
		$(SHARE_PREFIX)/locale \
		$(SHARE_PREFIX)/licenses/$(PKG_NAME)

	cp schemas/*.gschema.xml $(SHARE_PREFIX)/glib-2.0/schemas
	cp -r _build/locale/* $(SHARE_PREFIX)/locale
	cp _build/COPYING $(SHARE_PREFIX)/licenses/$(PKG_NAME)
endif

	rm -rf _build
	echo done

# ---- Releases ----
releases: mergepo _build
	mkdir -p releases

	cd _build && \
	zip -qr ../$(PKG_NAME)$(ZIPVER).zip .
	mv $(PKG_NAME)$(ZIPVER).zip releases/

	cd _build && \
	tar -czf ../$(PKG_NAME)$(ZIPVER).tar.gz .
	mv $(PKG_NAME)$(ZIPVER).tar.gz $(TARGZ)

	sha256sum $(TARGZ) > $(TARGZ).sha256
	cat $(TARGZ).sha256

help:
	printf '\n** Open-Meteo v%s (%s) **\n' \
		"$$(grep -oP '(?<="version-name": ")[^"]*' metadata.json)" \
		"$(GIT_VER)"
	printf 'Build to ./_build:\n\tmake\n'
	printf 'Install locally:\n\tmake install\n'
	printf 'Install system-wide:\n\tmake install DESTDIR=/usr/share\n'
	printf 'Update translations:\n\tmake mergepo\n'
	printf 'Build release archives:\n\tmake releases\n'
	printf 'Clean build artifacts:\n\tmake clean\n'
	printf 'Nested GNOME Shell test:\n\t./nest-test.sh\n\n'
