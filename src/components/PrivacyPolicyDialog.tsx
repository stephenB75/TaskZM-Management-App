import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

interface PrivacyPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyPolicyDialog({
  open,
  onOpenChange,
}: PrivacyPolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>
            Last updated: October 28, 2024
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">
                1. Information We Collect
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM collects information you provide directly
                to us, including your name, email address, and
                task data. We use this information to provide,
                maintain, and improve our services.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                2. How We Use Your Information
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Provide and maintain TaskZM services</li>
                <li>
                  Process your tasks and sync across devices
                </li>
                <li>
                  Send you service updates and notifications
                </li>
                <li>Improve scheduling recommendations</li>
                <li>Respond to your support requests</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                3. Data Storage and Security
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Your data is stored securely using Supabase
                infrastructure with industry-standard
                encryption. We implement appropriate technical
                and organizational measures to protect your
                personal information against unauthorized
                access, alteration, disclosure, or destruction.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                4. Calendar Integration
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                When you connect external calendar services
                (Google, Outlook, Apple), we access your
                calendar data only to sync tasks and events. We
                do not share this data with third parties and
                only use it for synchronization purposes.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                5. AI Features
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Our auto scheduling features analyze your task
                patterns locally to provide personalized
                recommendations. Task data used for Task analysis
                is processed securely and is not shared with
                external AI service providers.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                6. Data Sharing and Disclosure
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We do not sell your personal information. We may
                share your information only in the following
                circumstances:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>
                  With service providers who assist our
                  operations
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                7. Your Rights
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                8. Cookies and Tracking
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We use essential cookies to maintain your
                session and preferences. We do not use
                third-party tracking cookies for advertising
                purposes.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                9. Children's Privacy
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM is not intended for users under 13 years
                of age. We do not knowingly collect personal
                information from children under 13.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                10. Changes to This Policy
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to
                time. We will notify you of any changes by
                posting the new Privacy Policy on this page and
                updating the "Last updated" date.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                11. Contact Us
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy,
                please contact us at privacy@taskzm.app
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                12. Neurodivergent-Friendly Design
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We are committed to creating an accessible
                experience for neurodivergent users. Your
                feedback about accessibility features is
                valuable to us and helps improve TaskZM for all
                users.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}