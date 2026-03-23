import subprocess
import sys
import platform


class NuitkaBuilder:
    def __init__(self, target_script="./app"):
        self.target = target_script
        # Common flags used across ALL platforms
        self.base_args = [
            "python",
            "-m",
            "nuitka",
            "--standalone",
            "--onefile",
            "--lto=yes",
            "--python-flag=-m",
            "--python-flag=-OO",
            "--enable-plugin=upx",
            "--disable-bytecode-cache",
            "--assume-yes-for-downloads",
        ]

    def build_windows(self, debug=False):
        args = self.base_args.copy()

        # Windows specific flags
        args.extend(
            [
                "--windows-console-mode=disable",
                "--allow-import-from-plugin=anti-bloat:PIL.ImageQt",
                "--onefile-no-compression",
            ]
        )

        if debug:
            args.extend(["--clang", "--debug"])
        else:
            args.append("--windows-icon-from-ico=./assets/logo.ico")

        self._run(args)

    def build_linux(self):
        args = self.base_args.copy()
        args.append("--clang")
        self._run(args)

    def _run(self, args):
        args.append(self.target)
        print(f"🚀 Starting build: {' '.join(args)}\n")
        try:
            subprocess.run(args, check=True)
            print("\n✅ Build successful!")
        except subprocess.CalledProcessError as e:
            print(f"\n❌ Build failed with exit code {e.returncode}")
            sys.exit(e.returncode)


if __name__ == "__main__":
    builder = NuitkaBuilder()

    # Detect OS or use CLI args to decide what to build
    current_os = platform.system().lower()

    if len(sys.argv) > 1 and sys.argv[1] == "debug":
        builder.build_windows(debug=True)
    elif current_os == "windows":
        builder.build_windows()
    else:
        builder.build_linux()
