import { supabase } from '../supabase';

const GUEST_UID = '00000000-0000-0000-0000-000000000000';

export class DBService {
  private isGuest(uid: string) {
    return uid === GUEST_UID;
  }

  private getLocalData<T>(table: string): T[] {
    const data = localStorage.getItem(`deliciarte_${table}`);
    return data ? JSON.parse(data) : [];
  }

  private setLocalData<T>(table: string, data: T[]) {
    localStorage.setItem(`deliciarte_${table}`, JSON.stringify(data));
    // Trigger storage event for local subscription
    window.dispatchEvent(new Event('storage'));
  }

  async list<T>(table: string, uid: string): Promise<T[]> {
    if (this.isGuest(uid)) {
      return this.getLocalData<T>(table);
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('uid', uid);
    
    if (error) throw error;
    return data as T[];
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const uid = GUEST_UID; // Simplified for get, usually we'd pass uid
    if (this.isGuest(uid)) {
      const data = this.getLocalData<any>(table);
      return data.find((item: any) => item.id === id) || null;
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as T;
  }

  async getSingleByUid<T>(table: string, uid: string): Promise<T | null> {
    if (this.isGuest(uid)) {
      const data = this.getLocalData<any>(table);
      return data[0] || null;
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as T;
  }

  async create<T>(table: string, data: any): Promise<T> {
    if (this.isGuest(data.uid)) {
      const localData = this.getLocalData<any>(table);
      const newItem = { 
        ...data, 
        id: crypto.randomUUID(), 
        created_at: new Date().toISOString() 
      };
      localData.push(newItem);
      this.setLocalData(table, localData);
      return newItem as T;
    }

    const { data: created, error } = await supabase
      .from(table)
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return created as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    if (this.isGuest(data.uid)) {
      const localData = this.getLocalData<any>(table);
      const index = localData.findIndex((item: any) => item.id === id);
      if (index === -1) throw new Error('Item not found');
      
      const updatedItem = { ...localData[index], ...data };
      localData[index] = updatedItem;
      this.setLocalData(table, localData);
      return updatedItem as T;
    }

    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    // For delete, we don't always have the uid in the args, 
    // but we can check if it exists in localStorage first
    const localData = this.getLocalData<any>(table);
    const index = localData.findIndex((item: any) => item.id === id);
    
    if (index !== -1) {
      localData.splice(index, 1);
      this.setLocalData(table, localData);
      return;
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  subscribe<T>(table: string, uid: string, callback: (data: T[]) => void) {
    if (this.isGuest(uid)) {
      // Initial fetch
      callback(this.getLocalData<T>(table));

      // Listen for local changes
      const handleStorage = () => {
        callback(this.getLocalData<T>(table));
      };
      window.addEventListener('storage', handleStorage);
      
      return () => {
        window.removeEventListener('storage', handleStorage);
      };
    }

    // Fetch initial data
    this.list<T>(table, uid).then(callback).catch(console.error);

    const channel = supabase
      .channel(`public:${table}:uid=eq.${uid}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table, filter: `uid=eq.${uid}` }, 
        async () => {
          const data = await this.list<T>(table, uid);
          callback(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const dbService = new DBService();
