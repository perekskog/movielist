#!/usr/bin/env bash
# Creates the Azure resources for movielist, lets GitHub Actions deploy to
# them via OIDC, and configures the GitHub environments and variables (with
# gh, if logged in). Safe to re-run: existing resources are reused.
# See docs/deployment.md.
#
# Requires: az (logged in, access to SUBSCRIPTION) and optionally gh.
#
# To move to another subscription: SUBSCRIPTION=<name> ./infra/azure-setup.sh,
# redeploy, then delete the old resource group. The app URLs change.
#
# Every az command gets --subscription; the CLI default is left unchanged.
set -euo pipefail

SUBSCRIPTION="${SUBSCRIPTION:-per-sandbox}"
LOCATION="${LOCATION:-swedencentral}"
RG="${RG:-rg-movielist}"
CONTAINERAPP_ENV="${CONTAINERAPP_ENV:-movielist-env}"
APPS=(movielist movielist-feature)
GITHUB_REPO="perekskog/movielist"
GITHUB_ENVIRONMENTS=(production feature)
AD_APP_NAME="github-movielist-deploy"
# Placeholder until the first deploy from GitHub Actions.
PLACEHOLDER_IMAGE="mcr.microsoft.com/k8se/quickstart:latest"

sub=(--subscription "$SUBSCRIPTION" --only-show-errors)
SUBSCRIPTION_ID=$(az account show "${sub[@]}" --query id -o tsv)
TENANT_ID=$(az account show "${sub[@]}" --query tenantId -o tsv)
echo "Subscription: $SUBSCRIPTION ($SUBSCRIPTION_ID)"

echo "== Provider and CLI extension"
az provider register -n Microsoft.App "${sub[@]}" --wait
az extension add --name containerapp --upgrade --yes --only-show-errors

echo "== Resource group $RG"
az group create -n "$RG" -l "$LOCATION" "${sub[@]}" --output none

echo "== Container Apps environment $CONTAINERAPP_ENV"
if ! az containerapp env show -n "$CONTAINERAPP_ENV" -g "$RG" "${sub[@]}" &>/dev/null; then
  # No Log Analytics: avoids ingestion costs. Use 'az containerapp logs show --follow'.
  az containerapp env create -n "$CONTAINERAPP_ENV" -g "$RG" -l "$LOCATION" \
    --logs-destination none "${sub[@]}" --output none
fi

for app in "${APPS[@]}"; do
  echo "== Container App $app"
  if ! az containerapp show -n "$app" -g "$RG" "${sub[@]}" &>/dev/null; then
    # Scale to zero, at most one replica, smallest size.
    az containerapp create -n "$app" -g "$RG" "${sub[@]}" \
      --environment "$CONTAINERAPP_ENV" \
      --image "$PLACEHOLDER_IMAGE" \
      --ingress external --target-port 8080 \
      --min-replicas 0 --max-replicas 1 \
      --cpu 0.25 --memory 0.5Gi \
      --output none
  fi
done

echo "== Entra app $AD_APP_NAME (GitHub OIDC)"
APP_ID=$(az ad app list --display-name "$AD_APP_NAME" --query "[0].appId" -o tsv)
if [[ -z "$APP_ID" ]]; then
  APP_ID=$(az ad app create --display-name "$AD_APP_NAME" --query appId -o tsv)
fi
if ! az ad sp show --id "$APP_ID" &>/dev/null; then
  az ad sp create --id "$APP_ID" --output none
fi
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

for env in "${GITHUB_ENVIRONMENTS[@]}"; do
  name="github-$env"
  existing=$(az ad app federated-credential list --id "$APP_ID" \
    --query "[?name=='$name'].name" -o tsv)
  if [[ -z "$existing" ]]; then
    az ad app federated-credential create --id "$APP_ID" --output none --parameters "{
      \"name\": \"$name\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:$GITHUB_REPO:environment:$env\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
  fi
done

echo "== Role assignment: Contributor on $RG"
RG_ID=$(az group show -n "$RG" "${sub[@]}" --query id -o tsv)
existing=$(az role assignment list "${sub[@]}" --assignee "$SP_OBJECT_ID" \
  --scope "$RG_ID" --role Contributor --query "[].id" -o tsv)
if [[ -z "$existing" ]]; then
  az role assignment create "${sub[@]}" \
    --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
    --role Contributor --scope "$RG_ID" --output none
fi

echo "== GitHub environments and variables ($GITHUB_REPO)"
if command -v gh &>/dev/null && gh auth status &>/dev/null; then
  for env in "${GITHUB_ENVIRONMENTS[@]}"; do
    gh api -X PUT "repos/$GITHUB_REPO/environments/$env" --silent
  done
  gh variable set AZURE_CLIENT_ID -R "$GITHUB_REPO" -b "$APP_ID"
  gh variable set AZURE_TENANT_ID -R "$GITHUB_REPO" -b "$TENANT_ID"
  gh variable set AZURE_SUBSCRIPTION_ID -R "$GITHUB_REPO" -b "$SUBSCRIPTION_ID"
else
  echo "gh is not installed or not logged in. Create the environments"
  echo "(${GITHUB_ENVIRONMENTS[*]}) and set these repo variables by hand:"
  echo "  AZURE_CLIENT_ID=$APP_ID"
  echo "  AZURE_TENANT_ID=$TENANT_ID"
  echo "  AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
fi

echo
echo "Done."
echo
echo "App URLs:"
for app in "${APPS[@]}"; do
  fqdn=$(az containerapp show -n "$app" -g "$RG" "${sub[@]}" \
    --query properties.configuration.ingress.fqdn -o tsv)
  echo "  $app: https://$fqdn"
done
