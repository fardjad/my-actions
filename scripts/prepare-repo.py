#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass

API_HEADERS = [
    "Accept: application/vnd.github+json",
    "X-GitHub-Api-Version: 2026-03-10",
]


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def run(
    args: list[str],
    *,
    input_text: str | None = None,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        input=input_text,
        text=True,
        check=True,
        capture_output=capture_output,
    )


def gh_api(
    endpoint: str,
    *,
    method: str | None = None,
    body: dict | None = None,
) -> dict:
    args = ["gh", "api"]

    for header in API_HEADERS:
        args.extend(["-H", header])

    if method:
        args.extend(["--method", method])

    args.append(endpoint)

    input_text = None

    if body is not None:
        args.extend(["--input", "-"])
        input_text = json.dumps(body)

    result = run(args, input_text=input_text)

    if not result.stdout.strip():
        return {}

    return json.loads(result.stdout)


def gh_graphql(query: str, variables: dict) -> dict:
    return gh_api("graphql", body={"query": query, "variables": variables})


def set_repo_variable(repo: str, name: str, value: str) -> None:
    run(["gh", "variable", "set", name, "--repo", repo, "--body", value], capture_output=True)


def set_repo_secret(repo: str, name: str, value: str) -> None:
    run(["gh", "secret", "set", name, "--repo", repo], input_text=value, capture_output=True)


def parse_csv_list(value: str) -> list[str]:
    if not value:
        return []

    items = [item.strip() for item in value.split(",")]
    return sorted({item for item in items if item})


def append_step_summary(markdown: str) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")

    if not summary_path:
        return

    with open(summary_path, "a", encoding="utf-8") as summary_file:
        summary_file.write(markdown)


@dataclass
class TargetRepo:
    owner: str
    name: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.name}"


def parse_target_repo(value: str) -> TargetRepo:
    if "/" not in value:
        fail("TARGET_REPOSITORY must be in owner/repo form")

    owner, name = value.split("/", 1)
    return TargetRepo(owner=owner, name=name)


@dataclass
class Config:
    target: TargetRepo
    default_branch: str
    force_push_login: str
    source_app_id: str
    source_app_private_key: str
    extra_allowed_patterns: list[str]
    required_status_checks: list[str]


def env_first(*names: str) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value

    return ""


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare a GitHub repository for the auto-maintenance workflows by "
            "updating repository settings, Actions policy, branch protection, "
            "and app credentials."
        )
    )
    parser.add_argument(
        "repository",
        help="Target repository in owner/repo form.",
    )
    parser.add_argument(
        "--default-branch",
        default="main",
        help="Protected branch name. Default: %(default)s.",
    )
    parser.add_argument(
        "--force-push-login",
        default="fardjad",
        help="GitHub user login allowed to bypass the force-push restriction. Default: %(default)s.",
    )
    parser.add_argument(
        "--required-status-checks",
        default="",
        metavar="CHECK1,CHECK2",
        help="Comma-separated required status check names. Leave empty to leave required status checks unmanaged.",
    )
    parser.add_argument(
        "--extra-allowed-actions-patterns",
        default="",
        metavar="PATTERN1,PATTERN2",
        help="Comma-separated additional allowed action or reusable workflow patterns.",
    )
    parser.add_argument(
        "--source-app-id",
        default=env_first("SOURCE_APP_ID", "AUTO_MAINTENANCE_APP_ID"),
        help=(
            "App ID to copy into the target repository variable. "
            "Defaults to SOURCE_APP_ID or AUTO_MAINTENANCE_APP_ID from the environment."
        ),
    )

    private_key_group = parser.add_mutually_exclusive_group()
    private_key_group.add_argument(
        "--source-app-private-key",
        default=env_first("SOURCE_APP_PRIVATE_KEY", "AUTO_MAINTENANCE_APP_PRIVATE_KEY"),
        help=(
            "App private key PEM content to copy into the target repository secret. "
            "Defaults to SOURCE_APP_PRIVATE_KEY or AUTO_MAINTENANCE_APP_PRIVATE_KEY from the environment."
        ),
    )
    private_key_group.add_argument(
        "--source-app-private-key-file",
        help="Path to a file containing the app private key PEM to copy into the target repository secret.",
    )

    return parser


def parse_args(argv: list[str] | None = None) -> Config:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    source_app_id = args.source_app_id.strip()
    if not source_app_id:
        parser.error(
            "--source-app-id is required unless SOURCE_APP_ID or AUTO_MAINTENANCE_APP_ID is set"
        )

    source_app_private_key = args.source_app_private_key
    if args.source_app_private_key_file:
        try:
            with open(args.source_app_private_key_file, encoding="utf-8") as private_key_file:
                source_app_private_key = private_key_file.read()
        except OSError as error:
            parser.error(f"Could not read --source-app-private-key-file: {error}")

    source_app_private_key = source_app_private_key.strip()
    if not source_app_private_key:
        parser.error(
            "--source-app-private-key or --source-app-private-key-file is required unless "
            "SOURCE_APP_PRIVATE_KEY or AUTO_MAINTENANCE_APP_PRIVATE_KEY is set"
        )

    return Config(
        target=parse_target_repo(args.repository),
        default_branch=args.default_branch,
        force_push_login=args.force_push_login,
        source_app_id=source_app_id,
        source_app_private_key=source_app_private_key,
        extra_allowed_patterns=parse_csv_list(args.extra_allowed_actions_patterns),
        required_status_checks=parse_csv_list(args.required_status_checks),
    )


def update_repo_settings(target: TargetRepo) -> None:
    print("Updating repository settings")
    gh_api(
        f"repos/{target.owner}/{target.name}",
        method="PATCH",
        body={
            "allow_auto_merge": True,
            "delete_branch_on_merge": True,
            "allow_rebase_merge": True,
            "allow_merge_commit": False,
            "allow_squash_merge": False,
        },
    )


def update_actions_settings(
    target: TargetRepo,
    *,
    repo_visibility: str,
    repo_owner_type: str,
    extra_allowed_patterns: list[str],
) -> None:
    print("Updating GitHub Actions policy")
    gh_api(
        f"repos/{target.owner}/{target.name}/actions/permissions",
        method="PUT",
        body={"enabled": True, "allowed_actions": "selected"},
    )

    allowed_patterns = sorted({"fardjad/*@*", *extra_allowed_patterns})

    print("Updating allowed actions and reusable workflows")
    gh_api(
        f"repos/{target.owner}/{target.name}/actions/permissions/selected-actions",
        method="PUT",
        body={
            "github_owned_allowed": True,
            "verified_allowed": True,
            "patterns_allowed": allowed_patterns,
        },
    )

    if repo_visibility != "public":
        print("Updating private/internal workflow access")
        access_level = "organization" if repo_owner_type == "Organization" else "user"
        gh_api(
            f"repos/{target.owner}/{target.name}/actions/permissions/access",
            method="PUT",
            body={"access_level": access_level},
        )

    print("Updating workflow token permissions")
    gh_api(
        f"repos/{target.owner}/{target.name}/actions/permissions/workflow",
        method="PUT",
        body={
            "default_workflow_permissions": "write",
            "can_approve_pull_request_reviews": True,
        },
    )

    print("Updating external contributor approval policy")
    gh_api(
        f"repos/{target.owner}/{target.name}/actions/permissions/fork-pr-contributor-approval",
        method="PUT",
        body={"approval_policy": "all_external_contributors"},
    )


def update_branch_protection(
    target: TargetRepo,
    *,
    branch: str,
    force_push_login: str,
    required_status_checks: list[str],
) -> None:
    repo_data = gh_graphql(
        """
        query($owner: String!, $repo: String!, $forcePushLogin: String!) {
          repository(owner: $owner, name: $repo) {
            id
            branchProtectionRules(first: 100) {
              nodes {
                id
                pattern
              }
            }
          }
          user(login: $forcePushLogin) {
            id
          }
        }
        """,
        {
            "owner": target.owner,
            "repo": target.name,
            "forcePushLogin": force_push_login,
        },
    )["data"]

    repository = repo_data["repository"]
    force_push_user = repo_data["user"]

    if not force_push_user:
        fail(f"Could not resolve force-push user {force_push_login}")

    branch_rule = next(
        (
            rule
            for rule in repository["branchProtectionRules"]["nodes"]
            if rule["pattern"] == branch
        ),
        None,
    )

    branch_protection_input = {
        "pattern": branch,
        "allowsForcePushes": False,
        "bypassForcePushActorIds": [force_push_user["id"]],
        "dismissesStaleReviews": True,
        "requiredApprovingReviewCount": 1,
        "requiredStatusCheckContexts": required_status_checks,
        "requiresApprovingReviews": True,
        "requiresCodeOwnerReviews": True,
        "requiresConversationResolution": True,
        "requiresLinearHistory": True,
        "requiresStatusChecks": bool(required_status_checks),
        "requiresStrictStatusChecks": bool(required_status_checks),
    }

    if branch_rule:
        print(f"Updating branch protection rule for {branch}")
        gh_graphql(
            """
            mutation($input: UpdateBranchProtectionRuleInput!) {
              updateBranchProtectionRule(input: $input) {
                clientMutationId
              }
            }
            """,
            {"input": {"branchProtectionRuleId": branch_rule["id"], **branch_protection_input}},
        )
        return

    print(f"Creating branch protection rule for {branch}")
    gh_graphql(
        """
        mutation($input: CreateBranchProtectionRuleInput!) {
          createBranchProtectionRule(input: $input) {
            clientMutationId
          }
        }
        """,
        {"input": {"repositoryId": repository["id"], **branch_protection_input}},
    )


def main(argv: list[str] | None = None) -> None:
    config = parse_args(argv)

    print(f"Preparing {config.target.full_name}")

    repo_json = gh_api(f"repos/{config.target.owner}/{config.target.name}")
    repo_visibility = repo_json.get("visibility", "public")
    repo_owner_type = repo_json.get("owner", {}).get("type", "User")

    if config.required_status_checks:
        print(f"Required status checks: {', '.join(config.required_status_checks)}")
    else:
        print("Required status checks: not configured")

    update_repo_settings(config.target)
    update_actions_settings(
        config.target,
        repo_visibility=repo_visibility,
        repo_owner_type=repo_owner_type,
        extra_allowed_patterns=config.extra_allowed_patterns,
    )
    update_branch_protection(
        config.target,
        branch=config.default_branch,
        force_push_login=config.force_push_login,
        required_status_checks=config.required_status_checks,
    )

    print("Setting AUTO_MAINTENANCE_APP_ID repository variable")
    set_repo_variable(config.target.full_name, "AUTO_MAINTENANCE_APP_ID", config.source_app_id)

    print("Setting AUTO_MAINTENANCE_APP_PRIVATE_KEY repository secret")
    set_repo_secret(
        config.target.full_name,
        "AUTO_MAINTENANCE_APP_PRIVATE_KEY",
        config.source_app_private_key,
    )

    append_step_summary(
        f"""## Prepared {config.target.full_name}

- Branch protection updated for `{config.default_branch}`
- Rebase merge only enabled
- Auto-merge enabled
- Head branch deletion on merge enabled
- Actions policy set to selected actions and reusable workflows
- `AUTO_MAINTENANCE_APP_ID` variable updated
- `AUTO_MAINTENANCE_APP_PRIVATE_KEY` secret updated

### Required status checks

```
{chr(10).join(config.required_status_checks) if config.required_status_checks else "(not configured)"}
```

### Notes

- GitHub's documented API does not expose a setting for "Include Git LFS objects in archives", so this workflow does not change it.
- GitHub's documented API does not expose a setting for "Auto-close issues with merged linked pull requests", so this workflow does not change it.
- GitHub documents `patterns_allowed` for selected actions as applying to public repositories.
"""
    )


if __name__ == "__main__":
    main()
