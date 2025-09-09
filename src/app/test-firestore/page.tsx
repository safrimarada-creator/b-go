"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function TestFirestorePage() {
  const [users, setUsers] = useState<any[]>([]);

  // Ambil data dari Firestore
  useEffect(() => {
    async function fetchUsers() {
      const snapshot = await getDocs(collection(db, "users"));
      setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
    fetchUsers();
  }, []);

  // Tambah user baru (dummy)
  async function addUser() {
    await addDoc(collection(db, "users"), {
      name: "Tester",
      email: "tester@example.com",
      role: "customer",
    });
    alert("User ditambahkan!");
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">🔥 Test Firestore</h1>
      <button
        onClick={addUser}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Tambah User Dummy
      </button>
      <ul className="mt-6 list-disc pl-6">
        {users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email}) → {user.role}
          </li>
        ))}
      </ul>
    </main>
  );
}
