import test from "node:test";
import assert from "node:assert/strict";
import { folderPickerCommands, selectFolder, type FolderPickerRunner } from "../src/folder-picker.js";

test("uses the native Windows folder dialog", () => {
  const [command] = folderPickerCommands("win32");
  assert.equal(command?.file, "powershell.exe");
  assert.match(command?.args.join(" ") ?? "", /FolderBrowserDialog/);
  assert.match(command?.args.join(" ") ?? "", /Choose where Loom Studio should create the project/);
});

test("returns the selected folder without command whitespace", async () => {
  const run: FolderPickerRunner = async () => ({ stdout: "F:\\Writing\\Books\r\n", stderr: "" });
  assert.equal(await selectFolder({ platform: "win32", run }), "F:\\Writing\\Books");
});

test("returns null when the author cancels the picker", async () => {
  const run: FolderPickerRunner = async () => ({ stdout: "", stderr: "" });
  assert.equal(await selectFolder({ platform: "darwin", run }), null);
});

test("recognizes explicit macOS cancellation without hiding other script failures", async () => {
  const canceled: FolderPickerRunner = async () => { throw Object.assign(new Error("canceled"), { code: 1, stderr: "execution error: User canceled. (-128)" }); };
  assert.equal(await selectFolder({ platform: "darwin", run: canceled }), null);

  const failed: FolderPickerRunner = async () => { throw Object.assign(new Error("blocked"), { code: 1, stderr: "execution error: Not authorized" }); };
  await assert.rejects(() => selectFolder({ platform: "darwin", run: failed }), /Not authorized/);
});

test("falls back to kdialog when zenity is unavailable or fails to initialize", async () => {
  for (const zenityFailure of [
    Object.assign(new Error("missing"), { code: "ENOENT" }),
    Object.assign(new Error("display unavailable"), { code: 1, stderr: "Gtk-WARNING: cannot open display" }),
  ]) {
    const attempted: string[] = [];
    const run: FolderPickerRunner = async (file) => {
      attempted.push(file);
      if (file === "zenity") throw zenityFailure;
      return { stdout: "/home/writer/Books\n", stderr: "" };
    };
    assert.equal(await selectFolder({ platform: "linux", run }), "/home/writer/Books");
    assert.deepEqual(attempted, ["zenity", "kdialog"]);
  }
});

test("does not classify stderr-only success as cancellation", async () => {
  const run: FolderPickerRunner = async () => ({ stdout: "", stderr: "folder dialog failed" });
  await assert.rejects(() => selectFolder({ platform: "win32", run }), /folder dialog failed/);
});

test("reports when the host has no supported native folder dialog", async () => {
  await assert.rejects(() => selectFolder({ platform: "aix" }), /not supported on this operating system/i);
});
