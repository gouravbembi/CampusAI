import nodemailer from "nodemailer";

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export function createMailer(env: NodeJS.ProcessEnv): Mailer {
  const mode = env.MAIL_MODE ?? "disabled";
  if (mode === "disabled")
    return {
      async send() {
        throw new Error("Email delivery is disabled");
      },
    };
  const development = mode === "development";
  if ((!development && mode !== "smtp") || (development && env.NODE_ENV === "production")) {
    throw new Error("Invalid mail mode for this environment");
  }

  const host = env.SMTP_HOST;
  const from = env.MAIL_FROM;
  const port = Number(env.SMTP_PORT ?? (development ? 1025 : 587));
  if (
    !host ||
    !from ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)
  )
    throw new Error("Invalid SMTP configuration");
  const secure = !development && port === 465;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !development && !secure,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
  return {
    async send(message) {
      await transport.sendMail({ ...message, from });
    },
  };
}
