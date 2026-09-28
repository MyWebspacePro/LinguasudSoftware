import json
import subprocess
import sys
import time


SOURCE = "q9moxs4b19atpzyun9smuhgf-203847988577"
IMAGE = "q9moxs4b19atpzyun9smuhgf:957598c1b0553142c6bd54ad60237e7eb489219c"
CHECK = "linguasud-rollback-check"


def run(args, *, capture=False, check=True):
    return subprocess.run(
        args,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
    )


def inspect(container):
    result = run(["docker", "inspect", container], capture=True)
    return json.loads(result.stdout)[0]


def app_args(name, config, *, labels):
    args = [
        "docker", "run", "-d", "--name", name,
        "--network", config["HostConfig"]["NetworkMode"],
        "--restart", config["HostConfig"]["RestartPolicy"]["Name"],
        "--expose", "3000",
    ]
    for network in config["NetworkSettings"]["Networks"].values():
        for alias in network.get("Aliases") or []:
            args.extend(["--network-alias", alias])
    for item in config["Config"]["Env"]:
        args.extend(["-e", item])
    if labels:
        for key, value in config["Config"]["Labels"].items():
            args.extend(["--label", f"{key}={value}"])
    args.append(IMAGE)
    return args


def wait_healthy(name):
    for _ in range(20):
        result = run(
            ["docker", "exec", name, "node", "-e",
             'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(2))'],
            check=False,
        )
        if result.returncode == 0:
            return True
        time.sleep(2)
    return False


def check_candidate(config):
    run(["docker", "rm", "-f", CHECK], check=False)
    try:
        run(app_args(CHECK, config, labels=False))
        return wait_healthy(CHECK)
    finally:
        run(["docker", "rm", "-f", CHECK], check=False)


def main():
    config = inspect(SOURCE)
    run(["docker", "image", "inspect", IMAGE])
    if len(sys.argv) != 2 or sys.argv[1] not in {"check", "promote"}:
        raise SystemExit("Usage: rollback check|promote")

    if sys.argv[1] == "check":
        if not check_candidate(config):
            raise SystemExit("Rollback candidate did not pass /api/health; production container left unchanged.")
        print("Previous production image passes database startup and /api/health.")
        return

    if not check_candidate(config):
        raise SystemExit("Rollback candidate did not pass /api/health; production container left unchanged.")
    run(["docker", "stop", SOURCE])
    run(["docker", "rm", SOURCE])
    run(app_args(SOURCE, config, labels=True))
    if not wait_healthy(SOURCE):
        raise SystemExit("Rollback container started but did not pass /api/health; inspect its logs.")
    print("Previous production image restored; /api/health is passing.")


if __name__ == "__main__":
    main()
