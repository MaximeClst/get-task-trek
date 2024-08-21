"use client";

import { DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CalendarComponent() {
  const [currentEvents, setCurrentEvents] = useState<EventInput[]>([]);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Fetch events from API
    const fetchEvents = async () => {
      try {
        const response = await axios.get("/api/calendar/events");
        setCurrentEvents(response.data.events);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

  const handleDateSelect = async (selectInfo: DateSelectArg) => {
    const title = prompt("Veuillez entrer le titre de l'événement");
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect(); // Clear selection

    if (title) {
      try {
        const response = await axios.post("/api/calendar/events", {
          title,
          start: selectInfo.startStr,
          end: selectInfo.endStr,
          allDay: selectInfo.allDay,
        });
        calendarApi.addEvent(response.data.event);
      } catch (error) {
        console.error("Error creating event:", error);
      }
    }
  };

  const handleEventClick = async (clickInfo: EventClickArg) => {
    if (
      confirm(`Voulez-vous supprimer l'événement '${clickInfo.event.title}' ?`)
    ) {
      try {
        await axios.delete(`/api/calendar/events/${clickInfo.event.id}`);
        clickInfo.event.remove();
      } catch (error) {
        console.error("Error deleting event:", error);
      }
    }
  };

  return (
    <div className="p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        initialView="dayGridMonth"
        selectable={true}
        selectMirror={true}
        select={handleDateSelect}
        events={currentEvents}
        eventClick={handleEventClick}
        editable={true}
        dayMaxEvents={true}
        locale="fr" // Définit la langue en français
      />
    </div>
  );
}
