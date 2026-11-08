import Link from "next/link";
import {

  ArrowRight,

  CalendarDays,

  ClipboardList,

  Plus,

  Clock3,
  ChevronLeft,
  ChevronRight,

} from "lucide-react";

import type { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

import type {

  ClientRecord,

  LabOrder,

  UserRecord,

} from "@/lib/models";

import { formatDate, statusClass } from "@/lib/presentation";
import { requireUser } from "@/lib/session";

type AuditEvent = {

  _id: ObjectId;

  actorId: ObjectId;

  action: string;

  recordType: "client" | "labOrder";

  recordId: ObjectId;

  testCode?: string;

  changedFields?: string[];

  fromStatus?: string;

  toStatus?: string;

  panels?: string[];

  specimenType?: string;

  createdAt: Date;

};

type ActivityOrder = Pick<

  LabOrder,

  "_id" | "accessionId" | "clientSnapshot" | "tests"

>;

const changedFieldLabels: Record<string, string> = {

  result: "result",

  specimenType: "specimen",

  fullName: "name",

  dateOfBirth: "date of birth",

  phone: "phone",

  email: "email",

  address: "address",

};

export default async function DashboardPage({

  searchParams,

}: {

  searchParams: Promise<{

    date?: string | string[];

    page?: string | string[];

    month?: string | string[];

  }>;

}) {

  const currentUser = await requireUser();
  const lagosHour = Number(new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date()));
  const greeting = lagosHour >= 5 && lagosHour < 12
    ? "Good morning"
    : lagosHour >= 12 && lagosHour < 17
      ? "Good afternoon"
      : "Good evening";

  const params = await searchParams;

  const rawDate = Array.isArray(params.date)

    ? params.date[0]

    : params.date;

  const rawPage = Array.isArray(params.page)

    ? params.page[0]

    : params.page;

  const rawMonth = Array.isArray(params.month)

    ? params.month[0]

    : params.month;

  const parsedDate =

    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)

      ? new Date(`${rawDate}T00:00:00.000Z`)

      : null;

  const selectedDate =

    parsedDate &&

    !Number.isNaN(parsedDate.valueOf()) &&

    parsedDate.toISOString().slice(0, 10) === rawDate

      ? rawDate

      : undefined;

  const validMonth = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? new Date(`${rawMonth}-01T12:00:00`) : null;
  const calendarBase = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
  const calendarDate = validMonth && !Number.isNaN(validMonth.valueOf()) && validMonth.toISOString().slice(0, 7) === rawMonth ? validMonth : calendarBase;
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const calendarMonthValue = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`;
  const calendarMonthLabel = calendarDate.toLocaleDateString("en", { month: "long", year: "numeric" });
  const calendarOffset = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarDays: Array<number | null> = [...Array.from({ length: calendarOffset }, () => null), ...Array.from({ length: calendarDaysInMonth }, (_, index) => index + 1)];
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const calendarMonthHref = (offset: number) => {
    const nextMonth = new Date(calendarYear, calendarMonth + offset, 1);
    const search = new URLSearchParams();
    search.set("month", `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`);
    if (selectedDate) search.set("date", selectedDate);
    return `/dashboard?${search.toString()}`;
  };

    const parsedPage = Number.parseInt(rawPage ?? "1", 10);

  const currentPage =

    Number.isInteger(parsedPage) && parsedPage > 0

      ? parsedPage

      : 1;

  const ORDERS_PER_PAGE = 10;

  const database = await getDatabase();

  const orders = database.collection<LabOrder>("labOrders");

  const startDate = selectedDate

    ? new Date(`${selectedDate}T00:00:00.000Z`)

    : undefined;

  const endDate = startDate

    ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)

    : undefined;

  const orderFilter =

    startDate && endDate

      ? {

          createdAt: {

            $gte: startDate,

            $lt: endDate,

          },

        }

      : {};

  const activityEnd = new Date();

  const activityStart = new Date(

    activityEnd.getTime() - 60 * 60 * 1000

  );

  const orderCountPromise = orders.countDocuments(orderFilter);

  const recentOrdersPromise = orders

    .find(orderFilter)

    .sort({ createdAt: -1 })

    .skip((currentPage - 1) * ORDERS_PER_PAGE)

    .limit(ORDERS_PER_PAGE)

    .toArray();

  const activityPromise = database

    .collection<AuditEvent>("auditEvents")

    .find({

      recordType: { $in: ["client", "labOrder"] },

      actorId: { $type: "objectId" },

      recordId: { $type: "objectId" },

      createdAt: {

        $gte: activityStart,

        $lte: activityEnd,

      },

    })

    .sort({ createdAt: -1 })

    .limit(50)

    .toArray();

  const [totalOrders, recentOrders, activity] =

await Promise.all([

      orderCountPromise,

      recentOrdersPromise,

      activityPromise,

    ]);

  const totalPages = Math.max(

    1,

    Math.ceil(totalOrders / ORDERS_PER_PAGE)

  );

  const hasPreviousPage = currentPage > 1;

  const hasNextPage = currentPage < totalPages;

  const uniqueIds = (values: ObjectId[]) => [

    ...new Map(

      values.map((value) => [

        value.toHexString(),

        value,

      ])

    ).values(),

  ];

  const actorIds = uniqueIds(

    activity.map((event) => event.actorId)

  );

  const orderIds = uniqueIds(

    activity

      .filter(

        (event) => event.recordType === "labOrder"

      )

      .map((event) => event.recordId)

  );

  const patientIds = uniqueIds(

    activity

      .filter(

        (event) => event.recordType === "client"

      )

      .map((event) => event.recordId)

  );

  const [

    actors,

    activityOrders,

    activityPatients,

  ] = await Promise.all([

    actorIds.length

      ? database

          .collection<UserRecord>("users")

          .find(

            { _id: { $in: actorIds } },

            { projection: { name: 1 } }

          )

          .toArray()

      : [],

    orderIds.length

      ? database

          .collection<ActivityOrder>("labOrders")

          .find(

            { _id: { $in: orderIds } },

            {

              projection: {

                accessionId: 1,

                clientSnapshot: 1,

                tests: 1,

              },

            }

          )

          .toArray()

      : [],

    patientIds.length

      ? database

          .collection<ClientRecord>("clients")

          .find(

            { _id: { $in: patientIds } },

            { projection: { fullName: 1 } }

          )

          .toArray()

      : [],

  ]);

  const actorNames = new Map(

    actors.map((actor) => [

      actor._id.toHexString(),

      actor.name,

    ])

  );

  const activityOrderMap = new Map(

    activityOrders.map((order) => [

      order._id.toHexString(),

      order,

    ])

  );

  const patientNames = new Map(

    activityPatients.map((patient) => [

      patient._id.toHexString(),

      patient.fullName,

    ])

  );

  const activityDescription = (

    event: AuditEvent

  ) => {

    const order =

      event.recordType === "labOrder"

        ? activityOrderMap.get(

            event.recordId.toHexString()

          )

        : undefined;

    const patientName =

      event.recordType === "client"

        ? patientNames.get(

            event.recordId.toHexString()

          )

        : order?.clientSnapshot.fullName;

    const testName =

      order?.tests.find(

        (test) => test.code === event.testCode

      )?.name ?? "test result";

    const fieldList = event.changedFields

      ?.map(

        (field) =>

          changedFieldLabels[field] ?? field

      )

      .join(" and ");

    const statusChange =

      event.fromStatus && event.toStatus

        ? ` (${event.fromStatus} → ${event.toStatus})`

        : "";

    let action =

      "Updated a laboratory record";

if (event.action === "client.created") {

      action = `Registered patient ${

        patientName ?? "record"

      }`;

    } else if (

      event.action === "client.updated"

    ) {

      action = `Updated ${

        patientName ?? "patient"

      }${

        fieldList

          ? `: ${fieldList}`

          : ""

      }`;

    } else if (

      event.action === "order.created"

    ) {

      action = `Created order ${

        order?.accessionId ?? ""

      } for ${

        patientName ?? "patient"

      }${

        event.panels?.length

          ? ` · ${event.panels.join(", ")}`

          : ""

      }${

        event.specimenType

          ? ` · ${event.specimenType}`

          : ""

      }`;

    } else if (

      event.action === "test.edited"

    ) {

      action = `Edited ${testName}${

        fieldList

          ? `: ${fieldList}`

          : ""

      }${statusChange}`;

    } else if (

      event.action === "test.saved" ||

      event.action === "test.save"

    ) {

      action = `Saved ${testName} draft`;

    } else if (

      event.action === "test.submit"

    ) {

      action = `Sent ${testName} for review${statusChange}`;

    } else if (

      event.action === "test.complete"

    ) {

      action = `Reviewed ${testName}${statusChange}`;

    }

return {

      actor:

        actorNames.get(

          event.actorId.toHexString()

        ) ?? "Former staff member",

      action,

      context: order

        ? `${order.accessionId} · ${

            patientName ?? "Patient"

          }`

        : "Patient record",

    };

  };

  const activityTime = (date: Date) =>

    new Intl.DateTimeFormat("en-NG", {

      dateStyle: "medium",

      timeStyle: "short",

    }).format(date);

  const paginationHref = (page: number) => {

    const search = new URLSearchParams();

if (selectedDate) {

      search.set("date", selectedDate);

    }

    search.set("page", String(page));

return `/dashboard?${search.toString()}`;

  };

return (

    <main className="min-w-0 space-y-6 pb-8 text-slate-800">

      {/* Dashboard heading */}

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

        <div>

          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-teal-700">

           Laboratory Overview

          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">

            {greeting}, {currentUser.name}

          </h1>

          <p className="mt-1 text-sm text-slate-500">

            Monitor laboratory orders and filter orders by date.

          </p>

        </div>

        <Link

          href="/orders/new"

          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md bg-blue-500 px-3 text-sm font-medium transition hover:bg-blue-600 sm:self-auto"

        >

          <Plus size={16} color="white" />

          <span className="text-white font-bold">Create order</span>

        </Link>

      </header>

      {/* Main workspace */}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* Orders */}

        <section className="min-w-0">

          <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-base font-semibold text-slate-900">

                  {selectedDate

                    ? `Orders for ${formatDate(

                        selectedDate

                      )}`

                    : "Recent orders"}

                </h2>

                <span className="text-xs text-slate-500">

                  ({totalOrders})

                </span>

              </div>

              <p className="mt-1 text-xs text-slate-500">

                {selectedDate

                  ? "Orders created on the selected date"

                  : "The latest laboratory orders"}

              </p>

            </div>

            <Link

              href="/orders"

              className="inline-flex items-center gap-1 self-start text-xs font-medium text-teal-800 hover:underline sm:self-center"

            >

              View all orders

              <ArrowRight size={14} />

            </Link>

          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">

            {recentOrders.length === 0 ? (

              <div className="px-5 py-12 text-center">

                <ClipboardList

                  size={24}

                  className="mx-auto mb-3 text-slate-400"

                />

                <h3 className="text-sm font-medium text-slate-800">

                  {selectedDate

                    ? "No orders on this date"

                    : "No laboratory orders yet"}

                </h3>

                <p className="mt-1 text-xs text-slate-500">

                  {selectedDate

                    ? "Choose another date or clear the filter."

                    : "Create an order to begin processing laboratory tests."}

                </p>

                {!selectedDate && (

                  <Link

                    href="/orders/new"

                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600"

                  >

                    <Plus size={14} />

                    Create order

                  </Link>

                )}

              </div>

            ) : (

              <div className="w-full overflow-x-auto">

                <table className="w-full min-w-[650px] border-collapse text-left text-xs">

                  <thead>

                    <tr className="border-b border-slate-200 bg-slate-50">

                      <th className="px-4 py-3 font-semibold text-slate-500">

                        ACCESSION

                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-500">

                        PATIENT

                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-500">

                        TESTS

                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-500">

                        DATE

                      </th>

                      <th className="px-4 py-3 font-semibold text-slate-500">

                        STATUS

                      </th>

                      <th className="px-3 py-3" />

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {recentOrders.map((order) => {

                      const orderId =

                        order._id.toHexString();

return (

                        <tr

                          key={orderId}

                          className="transition-colors hover:bg-slate-50"

                        >

                          <td className="whitespace-nowrap px-4 py-3">

                            <Link

                              href={`/orders/${orderId}`}

                              className="font-semibold text-teal-800 hover:underline"

                            >

                              {order.accessionId}

                            </Link>

                          </td>

                          <td className="px-4 py-3">

                            <p className="font-medium text-slate-800">

                              {

                                order

                                  .clientSnapshot

                                  .fullName

                              }

                            </p>

                            <p className="mt-1 text-[10px] text-slate-500">

                              {

                                order

                                  .clientSnapshot

                                  .patientId

                              }

                            </p>

                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">

                            {order.tests.length}

                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">

                            {formatDate(

                              order.createdAt

                            )}

                          </td>

                          <td className="px-4 py-3">

                            <span

                              className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-medium ${statusClass(

                                order.status

                              )}`}

                            >

                              {order.status}

                            </span>

                          </td>

                          <td className="px-3 py-3">

                            <Link

                              href={`/orders/${orderId}`}

                              aria-label={`Open ${order.accessionId}`}

                              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-blue-50 hover:text-blue-800"

                            >

                              <ArrowRight size={15} />

                            </Link>

                          </td>

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

            {/* Pagination */}

            {totalOrders > ORDERS_PER_PAGE && (

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-[10px] text-slate-500">

                  Showing{" "}

                  {(currentPage - 1) *

                    ORDERS_PER_PAGE +

                    1}{" "}

                  to{" "}

                  {Math.min(

                    currentPage *

                      ORDERS_PER_PAGE,

                    totalOrders

                  )}{" "}

                  of {totalOrders} orders

                </p>

                <div className="flex items-center gap-2">

                  {hasPreviousPage ? (

                    <Link

                      href={paginationHref(

                        currentPage - 1

                      )}

                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"

                    >

                      Previous

                    </Link>

                  ) : (

                    <span className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-400">

                      Previous

                    </span>

                  )}

                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-xs font-medium text-white">

                    {currentPage}

                  </span>

                  {hasNextPage ? (

                    <Link

                      href={paginationHref(

                        currentPage + 1

                      )}

                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-blue-500 px-3 text-xs font-medium text-white transition hover:bg-blue-600"

                    >

                      Next 10

                      <ArrowRight size={13} />

                    </Link>

                  ) : (

                    <span className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-slate-100 px-3 text-xs font-medium text-slate-400">

                      Next 10

                    </span>

                  )}

                </div>

              </div>

            )}

            {totalOrders <= ORDERS_PER_PAGE && (

              <div className="border-t border-slate-200 px-4 py-3">

                <p className="text-[10px] text-slate-500">

                  Showing all {totalOrders}{" "}

                  {totalOrders === 1

                    ? "order"

                    : "orders"}.

                </p>

              </div>

            )}

          </div>

        </section>

        {/* Tools and activity */}

        <aside className="min-w-0 space-y-6">
          {/* Date filter — calendar rendered directly in this page */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF9FE] text-[#073F9F]"><CalendarDays size={17} /></div>
              <div><h2 className="text-sm font-semibold text-[#073F9F]">Filter by date</h2><p className="text-xs text-slate-500">Find orders by date</p></div>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{calendarMonthLabel}</h3>
              <div className="flex items-center gap-1">
                <Link href={calendarMonthHref(-1)} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#073F9F]"><ChevronLeft size={15} /></Link>
                <Link href={calendarMonthHref(1)} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#073F9F]"><ChevronRight size={15} /></Link>
              </div>
            </div>
            <div className="mb-1 grid grid-cols-7 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-xs font-medium text-slate-400">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((day, index) => {
                if (day === null) return <span key={`empty-${index}`} className="h-9" />;
                const value = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = value === selectedDate;
                const isToday = value === todayValue;
                return <Link key={value} href={`/dashboard?date=${value}&month=${calendarMonthValue}`} aria-label={`Filter orders for ${value}`} aria-current={isSelected ? "date" : undefined} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${isSelected ? "bg-blue-500 font-semibold text-white" : isToday ? "border border-blue-500 font-semibold text-[#073F9F]" : "text-slate-700 hover:bg-blue-50 hover:text-[#073F9F]"}`}>{day}</Link>;
              })}
            </div>
            {/* <form action="/dashboard" method="get" className="mt-4 space-y-2">
              <input type="hidden" name="month" value={calendarMonthValue} />
              <label htmlFor="dashboard-order-date" className="block text-xs font-medium text-slate-600">Or select a specific date</label>
              <input id="dashboard-order-date" name="date" type="date" defaultValue={selectedDate} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15" />
              <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"><CalendarDays size={15} />Apply filter</button>
              {selectedDate && <Link href="/dashboard" className="block py-1 text-center text-xs text-slate-500 hover:text-[#073F9F]">Clear filter</Link>}
            </form> */}
          </section>

          {/* Staff activity */}

{/* Staff activity */}
<section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
  <div className="mb-3 flex items-start justify-between gap-2">
    <div>
      <h2 className="text-sm font-semibold text-slate-900">
        Recent activity
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        Staff actions in the last hour
      </p>
    </div>

    <Clock3
      size={16}
      className="mt-0.5 shrink-0 text-slate-400"
    />
  </div>

  {activity.length === 0 ? (
    <p className="py-4 text-xs text-slate-500">
      No activity recorded in the last hour.
    </p>
  ) : (
    <div className="max-h-[280px] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]">
      <ul className="divide-y divide-slate-200">
        {activity.map((event) => {
          const description = activityDescription(event);

          return (
            <li
              key={event._id.toHexString()}
              className="py-3 first:pt-0"
            >
              <p className="break-words text-xs leading-5 text-slate-700">
                <span className="font-semibold text-slate-900">
                  {description.actor}
                </span>{" "}
                {description.action}
              </p>

              <p className="mt-1 break-words text-[10px] text-slate-500">
                {description.context}
              </p>

              <time
                dateTime={event.createdAt.toISOString()}
                className="mt-1 block text-[10px] text-slate-400"
              >
                {activityTime(event.createdAt)}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  )}

  <p className="mt-3 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
    Latest 50 events within the last hour.
  </p>
</section>


        </aside>

      </div>

    </main>

  );

}
