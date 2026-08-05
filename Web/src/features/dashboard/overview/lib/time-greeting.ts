import { copy } from "@/shared/config/copy";

export type TimeGreeting = {
  label: string;
};

function greetingLabel(template: string, name: string) {
  return template.replace("{name}", name);
}

export function resolveTimeGreeting(date: Date, name: string): TimeGreeting {
  const hour = date.getHours();
  const { overview } = copy.dashboard;

  if (hour >= 5 && hour < 12) {
    return {
      label: greetingLabel(overview.welcomeMorning, name),
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      label: greetingLabel(overview.welcomeAfternoon, name),
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      label: greetingLabel(overview.welcomeEvening, name),
    };
  }

  return {
    label: greetingLabel(overview.welcomeNight, name),
  };
}
