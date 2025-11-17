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

interface TermsOfServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsOfServiceDialog({
  open,
  onOpenChange,
}: TermsOfServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Last updated: October 28, 2024
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">
                1. Acceptance of Terms
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using TaskZM, you accept and
                agree to be bound by these Terms of Service. If
                you do not agree to these terms, please do not
                use our service.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                2. Description of Service
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM is a neurodivergent-friendly task
                management application that provides task
                organization, scheduling, calendar integration,
                AI-powered recommendations, and productivity
                analytics.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                3. User Accounts
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                To use TaskZM, you must create an account. You
                agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>
                  Provide accurate and complete information
                </li>
                <li>
                  Maintain the security of your account
                  credentials
                </li>
                <li>
                  Notify us immediately of unauthorized access
                </li>
                <li>
                  Be responsible for all activities under your
                  account
                </li>
                <li>Not share your account with others</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                4. Subscription Plans
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                TaskZM offers Free and Pro subscription tiers:
              </p>
              <div className="space-y-2 ml-2">
                <div>
                  <p className="font-medium">
                    Free Tier includes:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Unlimited tasks</li>
                    <li>Integrated calendar</li>
                    <li>Custom tags</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">
                    Pro Tier includes:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>AI Scheduler</li>
                    <li>Task Hours (Weekday/Weekend)</li>
                    <li>Analytics Dashboard</li>
                    <li>Unlimited Projects</li>
                    <li>Task Rollover</li>
                  </ul>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                5. Payment Terms
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Pro subscriptions are billed monthly. You agree
                to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Provide valid payment information</li>
                <li>Pay all charges at the prices in effect</li>
                <li>Allow automatic renewal unless canceled</li>
                <li>
                  Understand that refunds are subject to our
                  refund policy
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                6. Cancellation and Refunds
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                You may cancel your Pro subscription at any
                time. Cancellations take effect at the end of
                the current billing period. We offer prorated
                refunds within 7 days of purchase for annual
                subscriptions.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                7. Acceptable Use
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Use the service for illegal purposes</li>
                <li>
                  Attempt to gain unauthorized access to our
                  systems
                </li>
                <li>Interfere with the service's operation</li>
                <li>Upload malicious code or viruses</li>
                <li>
                  Abuse or harass other users or our support
                  team
                </li>
                <li>
                  Reverse engineer or copy the application
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                8. Calendar Integration
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                When connecting external calendar services, you
                grant TaskZM permission to access and modify
                your calendar events for synchronization
                purposes. You can revoke this permission at any
                time through Settings.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                9. Data Ownership and Export
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of all task data you
                create. You may export your data at any time in
                standard formats (CSV, JSON, iCal, PDF). Upon
                account deletion, your data will be permanently
                removed within 30 days.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                10. AI Features
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                AI scheduling recommendations are provided as
                suggestions only. We do not guarantee the
                accuracy or suitability of AI-generated
                schedules. You are responsible for reviewing and
                adjusting AI recommendations to fit your needs.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                11. Service Availability
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain 99.9% uptime but do not
                guarantee uninterrupted service. We may perform
                maintenance, updates, or experience technical
                issues that temporarily affect service
                availability.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                12. Intellectual Property
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM and its original content, features, and
                functionality are owned by TaskZM and protected
                by international copyright, trademark, and other
                intellectual property laws.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                13. Limitation of Liability
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM is provided "as is" without warranties.
                We are not liable for any indirect, incidental,
                special, or consequential damages arising from
                your use of the service, including data loss or
                missed tasks.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                14. Termination
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate
                your account for violations of these Terms. You
                may terminate your account at any time through
                Settings.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                15. Changes to Terms
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                We may modify these Terms at any time. We will
                notify you of material changes via email or
                in-app notification. Continued use after changes
                constitutes acceptance of new Terms.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                16. Governing Law
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                These Terms are governed by and construed in
                accordance with applicable laws. Any disputes
                will be resolved in the appropriate courts.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                17. Contact Information
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms, please contact
                us at support@taskzm.app
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="font-semibold mb-2">
                18. Accessibility Commitment
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                TaskZM is committed to maintaining an
                accessible, neurodivergent-friendly experience.
                We welcome feedback and continuously work to
                improve accessibility features.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}