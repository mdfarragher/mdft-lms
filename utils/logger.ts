import * as log from "$std/log/mod.ts";

log.setup({
  handlers: {
    console: new log.ConsoleHandler("DEBUG", {
      formatter: (record) =>
        `${record.datetime.toISOString()} [${record.levelName}] ${record.loggerName}: ${record.msg}`,
      useColors: true,
    }),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
    middleware: {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/index": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/login": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/profile": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/api/video-auth": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/courses": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/certifications": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/certification": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/dataset": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/tech": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/course": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/module": {
      level: "DEBUG",
      handlers: ["console"],
    },
    "routes/play": {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

export { log };
