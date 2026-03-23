import subprocess
import sys
import platform
import argparse
import io

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


class NuitkaBuilder:
    def __init__(self, target="./app", output_name=None):
        self.target = target
        self.output_name = output_name
        self.base_args = [
            sys.executable,
            "-m",
            "nuitka",
            "--standalone",
            "--onefile",
            "--lto=yes",
            "--python-flag=-m",
            "--python-flag=-OO",
            # "--enable-plugin=upx",
            "--disable-bytecode-cache",
            "--assume-yes-for-downloads",
        ]

    def build_windows(self, debug=False):
        args = self.base_args.copy()
        args.extend(
            [
                "--msvc=latest",
                # "--windows-console-mode=disable",
                # "--onefile-no-compression", # Enable when upx
                "--windows-icon-from-ico=./assets/logo.ico",
            ]
        )
        if debug:
            args.extend(["--debug"])

        self._run(args)

    def build_linux(self):
        args = self.base_args.copy()
        args.append("--clang")
        self._run(args)

    def _run(self, args):
        if self.output_name:
            args.append(f"--output-filename={self.output_name}")

        args.append(self.target)

        print(f"Building: {' '.join(args)}\n")
        try:
            subprocess.run(args, check=True)
            print("\nBuild successful!")
        except subprocess.CalledProcessError as e:
            print(f"\nBuild failed with exit code {e.returncode}")
            sys.exit(e.returncode)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="Final name of the binary")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    builder = NuitkaBuilder(output_name=args.output)

    if platform.system().lower() == "windows":
        builder.build_windows(debug=args.debug)
    else:
        builder.build_linux()
