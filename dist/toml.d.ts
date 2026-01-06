export type TomlValue = string | number | boolean | TomlTable;
export type TomlTable = {
    [key: string]: TomlValue;
};
export declare function parseToml(input: string): TomlTable;
