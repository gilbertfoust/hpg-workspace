import { Mail, Phone, MapPin, User } from "lucide-react";
import { Contact } from "@/hooks/useContacts";

interface ContactCardProps {
  contact: Contact;
}

export function ContactCard({ contact }: ContactCardProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 space-y-2">
        <div>
          <h4 className="font-medium">{contact.name}</h4>
          {contact.title && (
            <p className="text-sm text-muted-foreground">{contact.title}</p>
          )}
        </div>
        <div className="space-y-1">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <a href={`tel:${contact.phone}`} className="hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{contact.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
