@echo off
REM Mirror Solar Vision CRM - Tested Rollback Script
REM Rollback to commit fb0e0c8 ruleset in case of production regressions
echo =========================================================================
echo MIRROR SOLAR VISION CRM - FIREBASE SECURITY RULES EMERGENCY ROLLBACK
echo Target: Revert firestore.rules and storage.rules to commit fb0e0c8
echo =========================================================================

if not exist backups\rules_archive_fb0e0c8.rules (
  echo [ERROR] Backup file backups\rules_archive_fb0e0c8.rules not found!
  exit /b 1
)

copy /y backups\rules_archive_fb0e0c8.rules firestore.rules
copy /y backups\storage_archive_fb0e0c8.rules storage.rules

echo [SUCCESS] Replaced firestore.rules and storage.rules with fb0e0c8 archive.
echo To deploy to Firebase (Requires Project Owner Authorization):
echo   firebase deploy --only firestore:rules,storage
echo =========================================================================
