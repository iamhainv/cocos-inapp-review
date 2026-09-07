# InAppReview extension — iOS pre-build hook.
#
# AdMob's Pre-admob.cmake registers .xib resource files that must be listed in
# CC_UI_RESOURCES before the Xcode target is configured. InAppReview has no such
# resources, so this file is intentionally a no-op. It exists so the Cocos
# extension build-hook copy logic treats InAppReview identically to AdMob and
# can include() this file unconditionally.
