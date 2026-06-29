@echo off
setlocal
set PATCH_DIR=%~dp0

if not exist components mkdir components
copy /Y "%PATCH_DIR%components\TvRemoteNavigator.tsx" "components\TvRemoteNavigator.tsx"
copy /Y "%PATCH_DIR%components\TvDashboard.tsx" "components\TvDashboard.tsx"
copy /Y "%PATCH_DIR%components\TvSearchBox.tsx" "components\TvSearchBox.tsx"
copy /Y "%PATCH_DIR%components\FilterPanel.tsx" "components\FilterPanel.tsx"
copy /Y "%PATCH_DIR%components\MovieGrid.tsx" "components\MovieGrid.tsx"
copy /Y "%PATCH_DIR%components\Pagination.tsx" "components\Pagination.tsx"
copy /Y "%PATCH_DIR%components\MovieCard.tsx" "components\MovieCard.tsx"

echo Done. Run: npm run lint ^&^& npm run build
endlocal
