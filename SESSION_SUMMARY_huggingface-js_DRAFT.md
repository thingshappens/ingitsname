Draft PR: Huggingface JS investigation

This draft PR records the investigative work performed during the session to reproduce and run tests in the Hugging Face JS monorepo, and to try local builds. It is a draft for review and discussion.

Actions taken:
- Cloned huggingface/huggingface.js to /tmp/huggingface.js and ran workspace tests.
- Diagnosed missing workspace deps and wasm/native requirements; installed Rust toolchain to attempt builds.
- Added temporary devDependency (cli-progress) in a fork for testing, created a local shim for @huggingface/hub to run jinja tests to completion.
- Cleaned up temporary local artifacts; this draft PR accompanies the session summary.

