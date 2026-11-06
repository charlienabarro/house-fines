import { Suspense } from "react";
import { HouseApp } from "@/components/house-app";
import { NotAMember } from "@/components/not-a-member";
import { PintLoader } from "@/components/pint-loader";
import { getHouse } from "@/lib/house";

export default function TonightPage() {
  return (
    <Suspense fallback={<PintLoader />}>
      <Tonight />
    </Suspense>
  );
}

// Reads the session, so it streams in behind the Suspense boundary.
async function Tonight() {
  const { me, members, state } = await getHouse();
  if (!me || !state) return <NotAMember />;
  return <HouseApp me={me} members={members} initialState={state} />;
}
