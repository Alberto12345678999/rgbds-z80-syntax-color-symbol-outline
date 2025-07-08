export const tsconfig = {
  compilerOptions: {
    target: "ES2020",
    module: "commonjs",
    outDir: "./out",
    rootDir: "./",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true
  },
  include: ["**/*.ts"],
  exclude: ["node_modules", "out"]
};
