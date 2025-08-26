import { Project, SourceFile } from 'ts-morph';
import { assertNonNull } from '@foundation/contracts';

export interface CodemodResult {
  modified: boolean;
  files: string[];
  summary: string;
}

export type Codemod = (
  project: Project,
  targetGlobs?: string[]
) => Promise<CodemodResult> | CodemodResult;

export function result(modified: boolean, files: SourceFile[], summary: string): CodemodResult {
  assertNonNull(files, 'files');
  return { modified, files: files.map(f => f.getFilePath()), summary };
}
