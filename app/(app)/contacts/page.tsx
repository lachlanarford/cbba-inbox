import ContactsTable from '@/components/contacts/ContactsTable'

export default function ContactsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Contacts</h2>
        <p className="text-sm text-gray-400 mt-0.5">All contacts across your connected channels</p>
      </div>
      <ContactsTable />
    </div>
  )
}
