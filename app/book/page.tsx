import { redirect } from "next/navigation";

export default function Page() {
  redirect("/book/0");
  return null;
}
