export type PanCardName = {
  firstName: string;
  lastName: string;
};

export async function fetchPanCardName(panNumber: string): Promise<PanCardName> {
  await new Promise((resolve) => window.setTimeout(resolve, 900));

  if (panNumber === "INVALID123") {
    throw new Error("Could not fetch name for this PAN.");
  }

  return {
    firstName: "RAHUL",
    lastName: "SHARMA",
  };
}
