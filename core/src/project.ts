// The project a session works in, named the way people say it: the last part of its working directory.
export function projectName(cwd: string): string {
  return cwd.split('/').filter(Boolean).pop() ?? '';
}
