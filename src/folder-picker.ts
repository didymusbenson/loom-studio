import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface FolderPickerCommand {
  file: string;
  args: string[];
}

export type FolderPickerRunner = (
  file: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export interface SelectFolderOptions {
  platform?: NodeJS.Platform;
  run?: FolderPickerRunner;
}

const execFileAsync = promisify(execFile);

const defaultRunner: FolderPickerRunner = async (file, args) => {
  const { stdout, stderr } = await execFileAsync(file, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  return { stdout, stderr };
};

export function folderPickerCommands(platform: NodeJS.Platform): FolderPickerCommand[] {
  if (platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dialog.Description = 'Choose where Loom Studio should create the project'",
      "$dialog.ShowNewFolderButton = $true",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }",
    ].join("; ");
    return [{ file: "powershell.exe", args: ["-NoProfile", "-STA", "-Command", script] }];
  }

  if (platform === "darwin") {
    return [{
      file: "osascript",
      args: ["-e", "POSIX path of (choose folder with prompt \"Choose where Loom Studio should create the project\")"],
    }];
  }

  if (platform === "linux") {
    return [
      { file: "zenity", args: ["--file-selection", "--directory", "--title=Choose where Loom Studio should create the project"] },
      { file: "kdialog", args: ["--getexistingdirectory", ".", "--title", "Choose where Loom Studio should create the project"] },
    ];
  }

  return [];
}

function errorCode(error: unknown): string | number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return (error as { code?: string | number }).code;
}

function errorStderr(error: unknown): string {
  if (typeof error !== "object" || error === null || !("stderr" in error)) return "";
  return String((error as { stderr?: unknown }).stderr ?? "").trim();
}

function errorMessage(error: unknown): string {
  const stderr = errorStderr(error);
  if (stderr) return stderr;
  return error instanceof Error ? error.message : String(error);
}

function isCancellation(platform: NodeJS.Platform, error: unknown): boolean {
  if (errorCode(error) !== 1) return false;
  const stderr = errorStderr(error);
  if (platform === "darwin") return /user canceled|-128/i.test(stderr);
  if (platform === "linux") return stderr.length === 0;
  return false;
}

export async function selectFolder(options: SelectFolderOptions = {}): Promise<string | null> {
  const platform = options.platform ?? process.platform;
  const commands = folderPickerCommands(platform);
  if (commands.length === 0) throw new Error("Native folder selection is not supported on this operating system");

  const run = options.run ?? defaultRunner;
  let lastError: unknown;
  for (const [index, command] of commands.entries()) {
    try {
      const { stdout, stderr } = await run(command.file, command.args);
      const selected = stdout.trim();
      if (selected) return selected;
      if (stderr.trim()) throw new Error(stderr.trim());
      return null;
    } catch (error) {
      lastError = error;
      if (errorCode(error) === "ENOENT") continue;
      if (isCancellation(platform, error)) return null;
      if (platform === "linux" && index < commands.length - 1) continue;
      throw new Error(errorMessage(error), { cause: error });
    }
  }

  const detail = lastError && errorCode(lastError) !== "ENOENT" ? `: ${errorMessage(lastError)}` : "";
  throw new Error(`No native folder selector is available${detail}. Install zenity or kdialog, or enter the folder path manually.`);
}
