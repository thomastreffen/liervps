import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarOff, CheckCircle, ListTodo } from "lucide-react";
import { AbsenceRequestForm } from "@/components/absence/AbsenceRequestForm";
import { AbsenceApprovalList } from "@/components/absence/AbsenceApprovalList";
import { AbsenceMyRequests } from "@/components/absence/AbsenceMyRequests";

export default function AbsencePage() {
  const [tab, setTab] = useState("request");

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Fravær</h1>
        <p className="text-sm text-muted-foreground">
          Søk om ferie og fravær, eller godkjenn forespørsler
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="request" className="gap-1.5">
            <CalendarOff className="h-3.5 w-3.5" />
            Ny forespørsel
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Mine forespørsler
          </TabsTrigger>
          <TabsTrigger value="approve" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Godkjenning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request">
          <AbsenceRequestForm />
        </TabsContent>
        <TabsContent value="my">
          <AbsenceMyRequests />
        </TabsContent>
        <TabsContent value="approve">
          <AbsenceApprovalList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
