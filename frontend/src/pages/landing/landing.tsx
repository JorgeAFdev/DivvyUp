import Header from "../../components/header/header";
import LandingShell from "../../components/landing/landingShell";
import LandingHero from "../../components/landing/landingHero";
import LandingFeatures from "../../components/landing/landingFeatures";
import LandingFeature from "../../components/landing/landingFeature";
import LandingCta from "../../components/landing/landingCta";
import LandingFooter from "../../components/landing/landingFooter";
import BalancesVignette from "../../components/landing/vignettes/balancesVignette";
import MembersVignette from "../../components/landing/vignettes/membersVignette";
import NotificationsVignette from "../../components/landing/vignettes/notificationsVignette";
import { useAuth } from "../../context/userContextAuth";

const Landing = () => {
  const { isPending } = useAuth();

  // Header renders nothing until the session resolves, so painting the page
  // before then would drop the hero in and shove it down a moment later.
  if (isPending) return null;

  return (
    <LandingShell>
      <Header />

      <main>
        <LandingHero />

        <LandingFeatures>
          <LandingFeature
            eyebrow="Balances"
            title="Everyone nets out to zero"
            body="Add what you paid and who it was for. DivvyUp keeps every balance up to date and turns them into the shortest list of debts, so nobody has to work out who pays whom. Settle one with a single tap and the rest recalculates."
          >
            <BalancesVignette />
          </LandingFeature>

          <LandingFeature
            eyebrow="Invites"
            title="A member is a name, not an account"
            body="Add people by name and start splitting straight away. Share one link and they claim their name when they are ready, keeping every expense already in their history. Nobody is blocked on somebody else signing up."
          >
            <MembersVignette />
          </LandingFeature>

          <LandingFeature
            eyebrow="Real time"
            title="Everyone sees it as it happens"
            body="New expenses and settled debts reach the rest of the group the moment they happen, on every device that has the group open. No refreshing, no wondering whether the payment went through."
          >
            <NotificationsVignette />
          </LandingFeature>
        </LandingFeatures>

        <LandingCta />
      </main>

      <LandingFooter />
    </LandingShell>
  );
};

export default Landing;
