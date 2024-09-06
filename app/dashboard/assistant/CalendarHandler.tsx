import axios from "axios";

export const handleCalendarRequest = async (input: string, session: any) => {
  if (input.toLowerCase().includes("calendrier")) {
    const title = "Événement Calendrier";
    const start = new Date().toISOString();
    const end = new Date(new Date().getTime() + 60 * 60 * 1000).toISOString();

    await createCalendarEvent({
      title,
      start,
      end,
    });

    return {
      message: `Événement ajouté à votre calendrier, ${session?.user?.name}.`,
    };
  }
  return null;
};

const createCalendarEvent = async (eventDetails: {
  title: string;
  start: string;
  end: string;
}) => {
  await axios.post("/api/create-event", eventDetails);
};
