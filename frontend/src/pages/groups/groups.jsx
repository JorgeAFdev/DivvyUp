import { useState } from "react";
import GroupList from "../../components/group/groupList/groupList";
import CreateGroup from "../../components/group/createGroup/createGroup";

const Groups = () => {
    const [groups, setGroups] = useState([])

    return (
        <div>
            <GroupList groups={groups} setGroups={setGroups} />
            <CreateGroup setGroups={setGroups} />
        </div>
    )
};

export default Groups;
