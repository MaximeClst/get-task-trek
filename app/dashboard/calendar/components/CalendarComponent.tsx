"use client";

import { DateSelectArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CalendarComponent() {
  const [currentEvents, setCurrentEvents] = useState([]);
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

  const handleDateClick = (arg: DateClickArg) => {
    const start = arg.dateStr; // Utilisation correcte de `arg.dateStr`
    const url = `/dashboard/notes/create?start=${encodeURIComponent(start)}`;
    console.log("Redirecting to:", url);
    router.push(url);
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = selectInfo.startStr;
    const end = selectInfo.endStr;
    const url = `/dashboard/notes/create?start=${encodeURIComponent(
      start
    )}&end=${encodeURIComponent(end)}`;
    console.log("Redirecting to:", url);
    router.push(url);
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
        dateClick={handleDateClick}
        events={currentEvents}
        editable={true}
        dayMaxEvents={true}
        locale="fr"
      />
    </div>
  );
}
