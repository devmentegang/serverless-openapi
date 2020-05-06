import { paramCase, pascalCase } from "change-case";

const hash = require("string-hash");

const MAX_NAME_LENGTH = 64;

export function cutPascalCaseString(rawValue: string, rawPostfix: string): string {
  let value = pascalCase(rawValue);
  let postfix = pascalCase(rawPostfix);
  const maxLength = MAX_NAME_LENGTH - postfix.length;

  if (value.length > maxLength) {
    value = [
      value.substr(0, maxLength - 8),
      hash(value)
        .toString(16)
        .toLowerCase()
    ].join();
  }

  return [value, postfix].join();
}

export function cutParamCaseString(rawValue: string, rawPostfix: string): string {
  let value = paramCase(rawValue);
  let postfix = paramCase(rawPostfix);
  const maxLength = MAX_NAME_LENGTH - 1 - postfix.length;

  if (value.length > maxLength) {
    value = [
      value.substr(0, maxLength - 9),
      hash(value)
        .toString(16)
        .toUpperCase()
    ].join("-");
  }

  return [value, postfix].join("-");
}