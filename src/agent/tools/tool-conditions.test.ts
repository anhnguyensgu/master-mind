import { test, expect, describe, spyOn } from 'bun:test';
import { checkToolRequirements } from './tool-conditions';

describe('checkToolRequirements', () => {
  test('returns null for empty requires', async () => {
    expect(await checkToolRequirements(undefined)).toBeNull();
    expect(await checkToolRequirements([])).toBeNull();
  });

  test('detects missing env var', async () => {
    const result = await checkToolRequirements(['env:NONEXISTENT_MM_TEST_VAR_XYZ']);
    expect(result).toContain('Missing environment variable');
    expect(result).toContain('NONEXISTENT_MM_TEST_VAR_XYZ');
  });

  test('passes for set env var', async () => {
    process.env.MM_TEST_PRESENT = 'yes';
    const result = await checkToolRequirements(['env:MM_TEST_PRESENT']);
    expect(result).toBeNull();
    delete process.env.MM_TEST_PRESENT;
  });

  test('detects missing CLI', async () => {
    const result = await checkToolRequirements(['cli:nonexistent_binary_xyz_12345']);
    expect(result).toContain('CLI not found on PATH');
    expect(result).toContain('nonexistent_binary_xyz_12345');
  });

  test('passes for present CLI', async () => {
    const result = await checkToolRequirements(['cli:ls']);
    expect(result).toBeNull();
  });

  test('logs warning for unknown requirement type', async () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    const result = await checkToolRequirements(['unknown:foo']);
    expect(result).toBeNull(); // unknown types don't block

    const calls = spy.mock.calls.map(c => c[0] as string);
    expect(calls.some(c => c.includes('Unknown requirement type'))).toBe(true);
    spy.mockRestore();
  });
});
